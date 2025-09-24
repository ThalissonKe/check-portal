# 🛰️ Monitor de Portais da Transparência  

Um projeto automatizado para **monitorar a disponibilidade e o status de dados em portais da transparência municipais**, gerando um **dashboard interativo** com o histórico das verificações.  

---

## 📌 Sobre o Projeto  

Este projeto foi criado para **automatizar a verificação periódica** de portais da transparência que utilizam uma plataforma específica.  
O objetivo é:  

- Garantir que os portais estão online;  
- Confirmar que os dados de pessoal estão sendo publicados;  
- Criar um registro histórico da **estabilidade** e **disponibilidade** dessas informações ao longo do tempo.  

O resultado é um **dashboard online**, hospedado gratuitamente via **GitHub Pages**, que exibe o status atual de cada portal e permite a análise do histórico de cada entidade.  

---

## ⚙️ Como Funciona  

A arquitetura do projeto é dividida em **três componentes principais**:  

### 1️⃣ Robô de Coleta (Python)  

O coração do projeto é o script [`script/checker.py`](script/checker.py), responsável por fazer todo o trabalho pesado.  
Ele utiliza as seguintes bibliotecas:  

- **[Selenium](https://selenium.dev/)**: Automação do navegador Chrome em modo *headless* (sem interface gráfica) para navegar, interagir com elementos (iframes, menus) e verificar a presença de tabelas de dados.  
- **[Requests](https://docs.python-requests.org/)**: Verificação inicial do status HTTP dos links, antes de iniciar o navegador.  
- **[Pandas](https://pandas.pydata.org/)**: Manipulação e estruturação dos dados coletados.  

A cada execução, o script:  

- Lê uma lista de municípios e links do arquivo [`links.csv`](links.csv);  
- Visita cada link, mede o tempo de carregamento e verifica se a tabela de dados contém registros;  
- Tira um **screenshot** da página como evidência (salvo na pasta `dashboard/prints`);  
- Coleta as informações (status, alerta, ano, mês, etc.) e as salva em um único arquivo histórico: [`dashboard/historico_verificacoes.json`](dashboard/historico_verificacoes.json).  

---

### 2️⃣ Dashboard (Frontend)  

O dashboard é um site estático simples, mas poderoso, construído com:  

- **HTML**: Estrutura da página;  
- **CSS**: Estilização e responsividade;  
- **JavaScript**: Interatividade.  

O arquivo [`dashboard/script.js`](dashboard/script.js):  

- Carrega os dados do histórico via `fetch` do arquivo `historico_verificacoes.json`;  
- Usa a biblioteca [Chart.js](https://www.chartjs.org/) para criar gráficos interativos;  
- Popula dinamicamente a tabela principal com os dados detalhados da última verificação.  

---

### 3️⃣ Automação e Publicação (GitHub Actions + Pages)  

A integração com o **GitHub** é o que mantém tudo funcionando automaticamente:  

- **GitHub Actions**: Workflow definido em [`.github/workflows/main.yml`](.github/workflows/main.yml), que roda em horário agendado ou manualmente.  
- **Processo**: Ao ser acionado, o workflow executa o script Python, atualiza os dados na pasta `dashboard` e publica na branch `gh-pages`.  
- **GitHub Pages**: Hospeda automaticamente o conteúdo da branch `gh-pages` como site ao vivo.  

---

## 📂 Estrutura de Pastas  

```
📦 monitor-portais-transparencia
 ┣ 📂 .github/workflows
 ┃ ┗ 📜 main.yml           # Automação do GitHub Actions
 ┣ 📂 dashboard
 ┃ ┣ 📂 prints             # Evidências (screenshots)
 ┃ ┣ 📜 historico_verificacoes.json
 ┃ ┣ 📜 index.html
 ┃ ┣ 📜 style.css
 ┃ ┗ 📜 script.js
 ┣ 📂 script
 ┃ ┗ 📜 checker.py         # Robô de coleta de dados
 ┣ 📜 links.csv            # Lista de municípios e links
 ┗ 📜 README.md
```

---

## 🖥️ Como Configurar e Rodar Localmente  

1. Clone este repositório:  
   ```bash
   git clone https://github.com/seu-usuario/monitor-portais-transparencia.git
   cd monitor-portais-transparencia
   ```

2. Crie e ative um ambiente virtual Python:  
   ```bash
   python -m venv .venv
   source .venv/bin/activate   # Linux/Mac
   .venv\Scripts\activate      # Windows
   ```

3. Instale as dependências:  
   ```bash
   pip install -r requirements.txt
   ```

4. Execute o script de coleta:  
   ```bash
   python script/checker.py
   ```

5. Visualize o resultado abrindo o arquivo `dashboard/index.html` no seu navegador.  

---

## 🌐 Demo Online  

Acesse o dashboard publicado via GitHub Pages:  

➡️ [https://seu-usuario.github.io/monitor-portais-transparencia/](https://seu-usuario.github.io/monitor-portais-transparencia/)  

---

## 📝 Licença  

Este projeto está licenciado sob a [MIT License](LICENSE).  
