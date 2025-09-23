document.addEventListener("DOMContentLoaded", function() {
    // Busca o arquivo JSON que está na mesma pasta
    fetch('historico_verificacoes.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro na rede: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            const tableBody = document.querySelector("#report-table tbody");
            const dataAtualizacao = document.getElementById("data-atualizacao");
            
            if (data.length > 0) {
                dataAtualizacao.textContent = new Date(data[0]["Data/Hora"].replace(" ", "T")).toLocaleString("pt-BR");
            }

            tableBody.innerHTML = ''; 

            data.forEach(item => {
                const row = document.createElement('tr');
                
                if (item.Alerta === 'Erro Crítico' || item.Alerta === 'Sem dados') {
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
            
            gerarGrafico(data);
        })
        .catch(error => {
            console.error('Erro ao buscar ou processar os dados:', error);
            document.querySelector("#report-table tbody").innerHTML = '<tr><td colspan="7">Falha ao carregar os dados. Verifique o console para mais detalhes.</td></tr>';
            document.getElementById("data-atualizacao").textContent = "Erro!";
        });
});

function gerarGrafico(data) {
    const ctx = document.getElementById('statusChart').getContext('2d');
    
    const contagemAlertas = data.reduce((acc, item) => {
        const alerta = item.Alerta || "Não definido";
        acc[alerta] = (acc[alerta] || 0) + 1;
        return acc;
    }, {});

    const labels = Object.keys(contagemAlertas);
    const valores = Object.values(contagemAlertas);

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Status dos Portais',
                data: valores,
                backgroundColor: ['#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6', '#3498db'],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' }, title: { display: true, text: 'Distribuição de Status de Alerta' } }
        }
    });
}