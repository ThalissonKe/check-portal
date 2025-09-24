# Nome do arquivo: checker.py
import os
import time
import csv
import requests
import pandas as pd
import json # NOVO: Importa a biblioteca JSON
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import TimeoutException, WebDriverException

def make_driver(headless=True, timeout=40):
    """Cria e configura uma instância do WebDriver do Chrome."""
    chrome_options = Options()
    if headless:
        chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    )

    try:
        driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=chrome_options
        )
    except ValueError:
        print("Houve um erro com o ChromeDriverManager, tentando especificar o caminho.")
        driver = webdriver.Chrome(options=chrome_options)

    wait = WebDriverWait(driver, timeout)
    return driver, wait


def verificar_link(link, municipio, pasta_prints):
    """Verifica um único link, extrai as informações e salva uma evidência."""
    resultado = {
        "Município": municipio, "Link": link, "Ano": None, "Mês": None, "Status": None,
        "Código HTTP": None, "Tamanho Página (KB)": None, "Tempo Carregamento (s)": None,
        "Data/Hora": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "Evidência": None, "Alerta": None
    }
    inicio_tempo = time.time()

    try:
        r = requests.get(link, timeout=20, headers={'User-Agent': 'Mozilla/5.0'})
        resultado["Código HTTP"] = r.status_code
        resultado["Tamanho Página (KB)"] = round(len(r.content) / 1024, 2)
    except requests.exceptions.RequestException as e:
        resultado["Status"] = f"Erro HTTP: {e}"
        resultado["Alerta"] = "Erro Crítico"
        return resultado

    driver, wait = make_driver(headless=True, timeout=40)

    try:
        driver.get(link)

        try:
            ano_elem = wait.until(EC.presence_of_element_located((By.ID, "lblExercicio")))
            resultado["Ano"] = ano_elem.text if ano_elem.text else ano_elem.get_attribute("value")
        except TimeoutException:
            resultado["Ano"] = "Não encontrado"

        iframes = driver.find_elements(By.TAG_NAME, "iframe")
        if len(iframes) > 0:
            driver.switch_to.frame(iframes[0])

        try:
            mes_elem = wait.until(EC.presence_of_element_located((By.ID, "cmbMes_I")))
            mes_selecionado = mes_elem.get_attribute("value")
            resultado["Mês"] = mes_selecionado if mes_selecionado else "Não encontrado"
        except TimeoutException:
            resultado["Mês"] = "Não encontrado"

        try:
            tabela_container = wait.until(EC.visibility_of_element_located((By.ID, "gridPessoal_DXMainTable")))
            linhas_dados = tabela_container.find_elements(By.XPATH, ".//tr[starts-with(@id, 'gridPessoal_DXDataRow')]")
            num_linhas = len(linhas_dados)

            if num_linhas > 0:
                resultado["Status"] = f"OK - {num_linhas} registro(s) encontrado(s)"
                resultado["Alerta"] = "Poucos registros" if num_linhas < 5 else "OK"
            else:
                resultado["Status"] = "OK - Tabela vazia"
                resultado["Alerta"] = "Sem dados"
        except TimeoutException:
            page_source = driver.page_source
            if "Não foram encontrados dados de pessoal na opção selecionada" in page_source:
                resultado["Status"] = "OK - Sem dados (mensagem confirmada)"
                resultado["Alerta"] = "Sem dados"
            else:
                resultado["Status"] = "Erro - Tabela de dados não encontrada"
                resultado["Alerta"] = "Erro"

        nome_arquivo = f"{municipio.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        caminho_print = os.path.join(pasta_prints, nome_arquivo)
        driver.save_screenshot(caminho_print)
        # ALTERADO: Salva o caminho relativo para funcionar na web
        resultado["Evidência"] = f"prints/{nome_arquivo}"

    except WebDriverException as e:
        resultado["Status"] = f"Erro Selenium: {type(e).__name__}"
        resultado["Alerta"] = "Erro Crítico"
        try:
            nome_arquivo_erro = f"ERRO_{municipio.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            caminho_print_erro = os.path.join(pasta_prints, nome_arquivo_erro)
            driver.save_screenshot(caminho_print_erro)
            # ALTERADO: Salva o caminho relativo para funcionar na web
            resultado["Evidência"] = f"prints/{nome_arquivo_erro}"
        except Exception:
            pass
    finally:
        driver.quit()

    fim_tempo = time.time()
    resultado["Tempo Carregamento (s)"] = round(fim_tempo - inicio_tempo, 2)
    time.sleep(2.0)
    return resultado


# ALTERADO: Função para ler o histórico antigo e adicionar os novos resultados
def salvar_historico(novos_resultados, arquivo_json):
    """
    Lê o histórico existente, anexa os novos resultados,
    limita o total aos 60 registros mais recentes e salva o arquivo.
    """
    if not novos_resultados:
        print("Nenhum resultado novo para salvar.")
        return
    
    historico_completo = []
    try:
        # Passo 1: Tenta ler o arquivo de histórico que já existe
        if os.path.exists(arquivo_json) and os.path.getsize(arquivo_json) > 0:
            with open(arquivo_json, 'r', encoding='utf-8') as f:
                historico_completo = json.load(f)
        
        # Passo 2: Adiciona os novos resultados ao final da lista (sem sobrescrever)
        historico_completo.extend(novos_resultados)

        # Passo 3 (NOVO): Limita a lista para conter apenas os últimos 60 registros
        historico_limitado = historico_completo[-60:]

        # Passo 4: Salva a lista já limitada de volta no arquivo
        with open(arquivo_json, 'w', encoding='utf-8') as f:
            json.dump(historico_limitado, f, ensure_ascii=False, indent=4)
            
    except json.JSONDecodeError:
        print("Aviso: O arquivo JSON existente parece estar corrompido. Ele será sobrescrito com os novos dados.")
        # Garante que mesmo em caso de erro, o arquivo novo respeite o limite
        with open(arquivo_json, 'w', encoding='utf-8') as f:
            json.dump(novos_resultados[-60:], f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"ERRO ao salvar o arquivo JSON: {e}")


if __name__ == "__main__":
    # ALTERADO: Estrutura de pastas
    PASTA_DASHBOARD = "dashboard"
    PASTA_PRINTS = os.path.join(PASTA_DASHBOARD, "prints")
    ARQUIVO_CSV_LINKS = "links.csv"
    ARQUIVO_JSON_SAIDA = os.path.join(PASTA_DASHBOARD, "historico_verificacoes.json")

    # Cria as pastas se não existirem
    os.makedirs(PASTA_PRINTS, exist_ok=True)

    if not os.path.exists(ARQUIVO_CSV_LINKS):
        print(f"ERRO: Arquivo '{ARQUIVO_CSV_LINKS}' não encontrado!")
        exit()

    with open(ARQUIVO_CSV_LINKS, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        links_para_verificar = [row for row in reader if row]

    resultados_finais = []
    total_links = len(links_para_verificar)
    print(f"Iniciando verificação de {total_links} links...")
    for i, (municipio, link) in enumerate(links_para_verificar):
        print(f"[{i+1}/{total_links}] Verificando {municipio}...")
        resultado = verificar_link(link, municipio, PASTA_PRINTS)
        resultados_finais.append(resultado)
        print(f"-> Status: {resultado['Status']} | Alerta: {resultado['Alerta']}")

    # ALTERADO: Chama a função que salva em JSON
    salvar_historico(resultados_finais, ARQUIVO_JSON_SAIDA)
    print(f"\n✅ Verificação concluída. Relatório salvo em '{ARQUIVO_JSON_SAIDA}'")