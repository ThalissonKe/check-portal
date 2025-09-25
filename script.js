// Em dashboard/script.js

let historyChartInstance = null;

const colorMap = {
    'OK': '#2ecc71', 'Poucos registros': '#f1c40f', 'Sem dados': '#e74c3c',
    'Erro': '#e74c3c', 'Erro Crítico': '#c0392b', 'Não encontrado': '#95a5a6'
};

document.addEventListener("DOMContentLoaded", function() {
    fetch('historico_verificacoes.json')
        .then(response => response.json())
        .then(data => {
            if (data.length === 0) {
                document.querySelector("#report-table tbody").innerHTML = '<tr><td colspan="7">Nenhum dado encontrado para exibir.</td></tr>';
                return;
            }
            const entidadesUnicas = [...new Set(data.map(item => item.Município))];
            const numeroDeEntidades = entidadesUnicas.length > 0 ? entidadesUnicas.length : 1;
            const ultimosDados = data.slice(-numeroDeEntidades);
            popularTabela(ultimosDados);
            gerarGraficoPrincipal(ultimosDados);
            popularSeletorDeEntidades(data);
            document.getElementById('entity-selector').addEventListener('change', (event) => {
                const entidadeSelecionada = event.target.value;
                if (entidadeSelecionada) {
                    gerarGraficoHistorico(entidadeSelecionada, data);
                }
            });
        })
        .catch(error => console.error('Erro ao buscar ou processar os dados:', error));
});

function popularTabela(dados) {
    const tableBody = document.querySelector("#report-table tbody");
    const dataAtualizacao = document.getElementById("data-atualizacao");
    if (dados.length > 0) {
        dataAtualizacao.textContent = new Date(dados[dados.length - 1]["Data/Hora"].replace(" ", "T")).toLocaleString("pt-BR");
    }
    tableBody.innerHTML = ''; 
    dados.forEach(item => {
        const row = document.createElement('tr');
        if (item.Alerta?.includes('Erro') || item.Alerta?.includes('Sem dados')) { row.classList.add('alerta-critico'); } 
        else if (item.Alerta === 'Poucos registros') { row.classList.add('alerta-medio'); } 
        else { row.classList.add('alerta-ok'); }
        row.innerHTML = `
            <td>${item.Município}</td> <td>${item.Status}</td> <td>${item.Alerta}</td>
            <td>${item.Ano || 'N/A'}</td> <td>${item.Mês || 'N/A'}</td>
            <td>${new Date(item["Data/Hora"].replace(" ", "T")).toLocaleString("pt-BR")}</td>
            <td><a href="${item.Evidência}" target="_blank">Ver Print</a></td>
        `;
        tableBody.appendChild(row);
    });
}

function gerarGraficoPrincipal(dados) {
    // ... (esta função está correta, não precisa mudar)
    const ctx = document.getElementById('statusChart').getContext('2d');
    const contagemAlertas = dados.reduce((acc, item) => {
        const alerta = item.Alerta || "Não definido";
        acc[alerta] = (acc[alerta] || 0) + 1;
        return acc;
    }, {});
    const labels = Object.keys(contagemAlertas);
    const valores = Object.values(contagemAlertas);
    const backgroundColors = labels.map(label => colorMap[label] || '#bdc3c7');
    new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ label: 'Status dos Portais', data: valores, backgroundColor: backgroundColors, borderColor: '#fff', borderWidth: 2 }] }, options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Distribuição de Status da Última Verificação' } } } });
}

function popularSeletorDeEntidades(todosOsDados) {
    // ... (esta função está correta, não precisa mudar)
    const seletor = document.getElementById('entity-selector');
    const entidadesUnicas = [...new Set(todosOsDados.map(item => item.Município))].sort();
    seletor.innerHTML = '<option value="">-- Selecione uma entidade --</option>';
    entidadesUnicas.forEach(entidade => { const option = document.createElement('option'); option.value = entidade; option.textContent = entidade; seletor.appendChild(option); });
}

function gerarGraficoHistorico(entidade, todosOsDados) {
    // ----- INÍCIO DAS MUDANÇAS COM 'console.log' -----
    console.clear(); // Limpa o console para facilitar a leitura
    console.log("--- INICIANDO DEPURAÇÃO DO GRÁFICO HISTÓRICO ---");
    console.log("Entidade selecionada:", entidade);
    console.log("Total de registros recebidos:", todosOsDados.length);

    const ctx = document.getElementById('historyChart').getContext('2d');
    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 7);
    
    console.log("Filtrando entre as datas:", seteDiasAtras.toLocaleString('pt-BR'), "e", hoje.toLocaleString('pt-BR'));

    const dadosFiltrados = todosOsDados.filter(item => {
        const dataItem = new Date(item["Data/Hora"].replace(" ", "T"));
        const correspondeEntidade = item.Município === entidade;
        const estaNoIntervalo = dataItem >= seteDiasAtras && dataItem <= hoje;
        return correspondeEntidade && estaNoIntervalo;
    });

    console.log("Total de registros APÓS o filtro:", dadosFiltrados.length);
    console.log("Dados que serão plotados:", dadosFiltrados);
    console.log("--- FIM DA DEPURAÇÃO ---");
    // ----- FIM DAS MUDANÇAS COM 'console.log' -----

    const dadosParaGrafico = dadosFiltrados.map(item => ({
        x: new Date(item["Data/Hora"].replace(" ", "T")),
        y: (item.Alerta === 'OK' || item.Alerta === 'Poucos registros') ? 1 : 0
    }));

    if (historyChartInstance) { historyChartInstance.destroy(); }
    historyChartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets: [{ label: `Histórico de Status para ${entidade}`, data: dadosParaGrafico, borderColor: '#3498db', backgroundColor: 'rgba(52, 152, 219, 0.2)', fill: true, stepped: true }] },
        options: { responsive: true, scales: { x: { type: 'time', time: { tooltipFormat: 'dd/MM/yyyy HH:mm' }, title: { display: true, text: 'Data' } }, y: { ticks: { stepSize: 1, callback: function(value) { if (value === 1) return 'OK'; if (value === 0) return 'Com Falha'; } }, title: { display: true, text: 'Status' } } } }
    });
}