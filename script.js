// Em dashboard/script.js

// Variável global para guardar a instância do gráfico histórico
let historyChartInstance = null;

// Mapa de cores para o gráfico principal
const colorMap = {
    'OK': '#2ecc71', // Verde
    'Poucos registros': '#f1c40f', // Amarelo
    'Sem dados': '#e74c3c', // Vermelho
    'Erro': '#e74c3c', // Vermelho
    'Erro Crítico': '#c0392b', // Vermelho escuro
    'Não encontrado': '#95a5a6' // Cinza
};

document.addEventListener("DOMContentLoaded", function() {
    fetch('historico_verificacoes.json')
        .then(response => response.json())
        .then(data => {
            // Pega apenas os dados da última execução para a tabela e gráfico principal
            // Assumindo que o número de municípios é constante
            const municipios = [...new Set(data.map(item => item.Município))];
            const ultimosDados = data.slice(-municipios.length);

            popularTabela(ultimosDados);
            gerarGraficoPrincipal(ultimosDados);
            
            // Usa todos os dados para o seletor e gráfico histórico
            popularSeletorDeEntidades(data);

            // Adiciona o "escutador" de eventos ao seletor
            document.getElementById('entity-selector').addEventListener('change', (event) => {
                const entidadeSelecionada = event.target.value;
                if (entidadeSelecionada) {
                    gerarGraficoHistorico(entidadeSelecionada, data);
                }
            });
        })
        .catch(error => {
            console.error('Erro ao buscar ou processar os dados:', error);
            // ... (código de tratamento de erro) ...
        });
});

function popularTabela(dados) {
    const tableBody = document.querySelector("#report-table tbody");
    const dataAtualizacao = document.getElementById("data-atualizacao");

    if (dados.length > 0) {
        dataAtualizacao.textContent = new Date(dados[0]["Data/Hora"].replace(" ", "T")).toLocaleString("pt-BR");
    }
    tableBody.innerHTML = ''; 

    dados.forEach(item => {
        const row = document.createElement('tr');
        if (item.Alerta?.includes('Erro') || item.Alerta?.includes('Sem dados')) {
            row.classList.add('alerta-critico');
        } else if (item.Alerta === 'Poucos registros') {
            row.classList.add('alerta-medio');
        } else {
            row.classList.add('alerta-ok');
        }
        row.innerHTML = `
            <td>${item.Município}</td>
            <td>${item.Status}</td>
            <td>${item.Alerta}</td>
            <td>${item.Ano || 'N/A'}</td>
            <td>${item.Mês || 'N/A'}</td>
            <td>${new Date(item["Data/Hora"].replace(" ", "T")).toLocaleString("pt-BR")}</td>
            <td><a href="${item.Evidência}" target="_blank">Ver Print</a></td>
        `;
        tableBody.appendChild(row);
    });
}

function gerarGraficoPrincipal(dados) {
    const ctx = document.getElementById('statusChart').getContext('2d');
    const contagemAlertas = dados.reduce((acc, item) => {
        const alerta = item.Alerta || "Não definido";
        acc[alerta] = (acc[alerta] || 0) + 1;
        return acc;
    }, {});

    const labels = Object.keys(contagemAlertas);
    const valores = Object.values(contagemAlertas);
    // Gera as cores dinamicamente com base no mapa de cores
    const backgroundColors = labels.map(label => colorMap[label] || '#bdc3c7');

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Status dos Portais',
                data: valores,
                backgroundColor: backgroundColors,
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' }, title: { display: true, text: 'Distribuição de Status da Última Verificação' } }
        }
    });
}

function popularSeletorDeEntidades(todosOsDados) {
    const seletor = document.getElementById('entity-selector');
    const entidadesUnicas = [...new Set(todosOsDados.map(item => item.Município))].sort();

    seletor.innerHTML = '<option value="">-- Selecione uma entidade --</option>'; // Limpa e adiciona a opção padrão

    entidadesUnicas.forEach(entidade => {
        const option = document.createElement('option');
        option.value = entidade;
        option.textContent = entidade;
        seletor.appendChild(option);
    });
}

function gerarGraficoHistorico(entidade, todosOsDados) {
    const ctx = document.getElementById('historyChart').getContext('2d');

    // Filtra os dados para a entidade selecionada e os últimos 7 dias
    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 7);

    const dadosFiltrados = todosOsDados.filter(item => {
        const dataItem = new Date(item["Data/Hora"].replace(" ", "T"));
        return item.Município === entidade && dataItem >= seteDiasAtras && dataItem <= hoje;
    });

    // Mapeia o status para um valor numérico para o gráfico: OK = 1, Problema = 0
    const dadosParaGrafico = dadosFiltrados.map(item => ({
        x: new Date(item["Data/Hora"].replace(" ", "T")),
        y: (item.Alerta === 'OK' || item.Alerta === 'Poucos registros') ? 1 : 0
    }));

    // Destrói o gráfico anterior se ele existir
    if (historyChartInstance) {
        historyChartInstance.destroy();
    }

    historyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: `Histórico de Status para ${entidade}`,
                data: dadosParaGrafico,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                fill: true,
                stepped: true // Cria um gráfico de "degraus", bom para status
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        tooltipFormat: 'dd/MM/yyyy HH:mm'
                    },
                    title: {
                        display: true,
                        text: 'Data'
                    }
                },
                y: {
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            if (value === 1) return 'OK';
                            if (value === 0) return 'Com Falha';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Status'
                    }
                }
            }
        }
    });
}