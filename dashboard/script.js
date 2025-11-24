let dadosHistorico = [];
let snapshotAtual = []; // último registro de cada município
let historyChartInstance = null;
let statusChartInstance = null;

const colorMap = {
  "OK": "#2ecc71",
  "Poucos registros": "#f1c40f",
  "Sem dados": "#e74c3c",
  "Erro": "#e74c3c",
  "Erro Crítico": "#c0392b",
  "Não encontrado": "#95a5a6"
};

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("historico_verificacoes.json");
    dadosHistorico = await response.json();

    if (!dadosHistorico || dadosHistorico.length === 0) {
      document.querySelector("#report-table tbody").innerHTML =
        '<tr><td colspan="8">Nenhum dado encontrado para exibir.</td></tr>';
      return;
    }

    // Ordena por data/hora (ascendente)
    dadosHistorico.sort(
      (a, b) =>
        new Date(a["Data/Hora"].replace(" ", "T")) -
        new Date(b["Data/Hora"].replace(" ", "T"))
    );

    prepararSnapshotAtual();
    atualizarUltimaAtualizacao();
    prepararFiltros();
    atualizarKPIs();
    gerarGraficoStatus();
    popularTabela();
    popularSeletorDeEntidades();
    configurarListeners();
    configurarModalPrint();
  } catch (error) {
    console.error("Erro ao buscar ou processar os dados:", error);
  }
});

function parseData(str) {
  return new Date(str.replace(" ", "T"));
}

/**
 * Cria o snapshotAtual: último registro de cada município.
 */
function prepararSnapshotAtual() {
  const mapa = new Map();

  dadosHistorico.forEach((item) => {
    const mun = item["Município"];
    const dataItem = parseData(item["Data/Hora"]);
    const atual = mapa.get(mun);

    if (!atual || parseData(atual["Data/Hora"]) < dataItem) {
      mapa.set(mun, item);
    }
  });

  snapshotAtual = Array.from(mapa.values()).sort((a, b) =>
    a["Município"].localeCompare(b["Município"])
  );
}

function atualizarUltimaAtualizacao() {
  const ultimo = dadosHistorico[dadosHistorico.length - 1];
  const span = document.getElementById("data-atualizacao");
  span.textContent = parseData(ultimo["Data/Hora"]).toLocaleString("pt-BR");
}

function prepararFiltros() {
  const anos = new Set();
  const meses = new Set();
  const alertas = new Set();

  snapshotAtual.forEach((item) => {
    if (item["Ano"]) anos.add(item["Ano"]);
    if (item["Mês"]) meses.add(item["Mês"]);
    if (item["Alerta"]) alertas.add(item["Alerta"]);
  });

  preencherSelect("filtroAno", Array.from(anos).sort());
  preencherSelect("filtroMes", Array.from(meses));
  preencherSelect("filtroAlerta", Array.from(alertas).sort());
}

function preencherSelect(id, valores) {
  const select = document.getElementById(id);
  if (!select) return;

  valores.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
}

function atualizarKPIs() {
  const totalPortais = snapshotAtual.length;

  const okLike = snapshotAtual.filter(
    (r) => r["Alerta"] === "OK" || r["Alerta"] === "Poucos registros"
  ).length;

  const problemaCount = totalPortais - okLike;

  const tempos = snapshotAtual
    .map((r) => parseFloat(r["Tempo Carregamento (s)"]))
    .filter((t) => !isNaN(t));

  const tempoMedio =
    tempos.length > 0
      ? (tempos.reduce((a, b) => a + b, 0) / tempos.length).toFixed(2)
      : "-";

  document.getElementById("kpiTotalPortais").textContent = totalPortais;
  document.getElementById("kpiOkCount").textContent = okLike;
  document.getElementById(
    "kpiOkPercent"
  ).textContent = totalPortais
    ? `${((okLike / totalPortais) * 100).toFixed(1)}% dos portais`
    : "";
  document.getElementById("kpiProblemaCount").textContent = problemaCount;
  document.getElementById("kpiTempoMedio").textContent =
    tempoMedio === "-" ? "-" : `${tempoMedio}s`;
}

function gerarGraficoStatus() {
  const ctx = document.getElementById("statusChart").getContext("2d");

  const contagemAlertas = snapshotAtual.reduce((acc, item) => {
    const alerta = item["Alerta"] || "Não definido";
    acc[alerta] = (acc[alerta] || 0) + 1;
    return acc;
  }, {});

  const labels = Object.keys(contagemAlertas);
  const valores = Object.values(contagemAlertas);
  const backgroundColors = labels.map(
    (label) => colorMap[label] || "#bdc3c7"
  );

  if (statusChartInstance) statusChartInstance.destroy();

  statusChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          label: "Status dos Portais",
          data: valores,
          backgroundColor: backgroundColors,
          borderColor: "#fff",
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        title: {
          display: false
        }
      }
    }
  });
}

function popularTabela() {
  const tbody = document.querySelector("#report-table tbody");
  tbody.innerHTML = "";

  const filtros = coletarFiltrosTabela();

  const registrosFiltrados = snapshotAtual.filter((item) => {
    const busca = filtros.busca.toLowerCase();

    const matchBusca =
      !busca ||
      item["Município"].toLowerCase().includes(busca);

    const matchAno = !filtros.ano || item["Ano"] === filtros.ano;
    const matchMes = !filtros.mes || item["Mês"] === filtros.mes;
    const matchAlerta =
      !filtros.alerta || item["Alerta"] === filtros.alerta;

    return matchBusca && matchAno && matchMes && matchAlerta;
  });

  if (!registrosFiltrados.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = "Nenhum registro encontrado com os filtros atuais.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  registrosFiltrados.forEach((item) => {
    const tr = document.createElement("tr");

    // classes de destaque por alerta
    if (
      item["Alerta"]?.includes("Erro") ||
      item["Alerta"]?.includes("Sem dados")
    ) {
      tr.classList.add("alerta-critico");
    } else if (item["Alerta"] === "Poucos registros") {
      tr.classList.add("alerta-medio");
    } else {
      tr.classList.add("alerta-ok");
    }

    const tdMun = document.createElement("td");
    tdMun.textContent = item["Município"];

    const tdStatus = document.createElement("td");
    tdStatus.textContent = item["Status"];

    const tdAlerta = document.createElement("td");
    const span = document.createElement("span");
    span.classList.add("badge-status");

    if (item["Alerta"] === "OK") span.classList.add("badge-ok");
    else if (item["Alerta"] === "Poucos registros")
      span.classList.add("badge-alerta");
    else span.classList.add("badge-erro");

    span.textContent = item["Alerta"];
    tdAlerta.appendChild(span);

    const tdAno = document.createElement("td");
    tdAno.textContent = item["Ano"] || "N/A";

    const tdMes = document.createElement("td");
    tdMes.textContent = item["Mês"] || "N/A";

    const tdData = document.createElement("td");
    tdData.textContent = parseData(item["Data/Hora"]).toLocaleString("pt-BR");

    const tdTempo = document.createElement("td");
    tdTempo.textContent = item["Tempo Carregamento (s)"] ?? "-";

    const tdEvid = document.createElement("td");
    const link = document.createElement("span");
    link.textContent = "Ver Print";
    link.classList.add("link-print");
    link.dataset.print = item["Evidência"];
    tdEvid.appendChild(link);

    tr.append(
      tdMun,
      tdStatus,
      tdAlerta,
      tdAno,
      tdMes,
      tdData,
      tdTempo,
      tdEvid
    );
    tbody.appendChild(tr);
  });
}

/* Filtros */

function coletarFiltrosTabela() {
  return {
    busca: document.getElementById("filtroBusca").value.trim(),
    ano: document.getElementById("filtroAno").value,
    mes: document.getElementById("filtroMes").value,
    alerta: document.getElementById("filtroAlerta").value
  };
}

function configurarListeners() {
  ["filtroBusca", "filtroAno", "filtroMes", "filtroAlerta"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", popularTabela);
    el.addEventListener("change", popularTabela);
  });

  // histórico por entidade
  document
    .getElementById("entity-selector")
    .addEventListener("change", (event) => {
      const entidade = event.target.value;
      if (entidade) {
        gerarGraficoHistorico(entidade);
      } else if (historyChartInstance) {
        historyChartInstance.destroy();
      }
    });

  // clique em "Ver Print" na tabela (delegação)
  document
    .getElementById("report-table")
    .addEventListener("click", (event) => {
      const target = event.target;
      if (target.classList.contains("link-print")) {
        const src = target.dataset.print;
        abrirModalPrint(src);
      }
    });
}

/* Seletor e gráfico histórico */

function popularSeletorDeEntidades() {
  const seletor = document.getElementById("entity-selector");
  const entidadesUnicas = [
    ...new Set(dadosHistorico.map((item) => item["Município"]))
  ].sort();

  seletor.innerHTML = '<option value="">-- Selecione uma entidade --</option>';

  entidadesUnicas.forEach((ent) => {
    const opt = document.createElement("option");
    opt.value = ent;
    opt.textContent = ent;
    seletor.appendChild(opt);
  });
}

function gerarGraficoHistorico(entidade) {
  const ctx = document.getElementById("historyChart").getContext("2d");

  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);

  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(hoje.getDate() - 7);
  seteDiasAtras.setHours(0, 0, 0, 0);

  const dadosFiltrados = dadosHistorico.filter((item) => {
    const dataItem = parseData(item["Data/Hora"]);
    return (
      item["Município"] === entidade &&
      dataItem >= seteDiasAtras &&
      dataItem <= hoje
    );
  });

  const dadosParaGrafico = dadosFiltrados.map((item) => ({
    x: parseData(item["Data/Hora"]),
    y:
      item["Alerta"] === "OK" || item["Alerta"] === "Poucos registros"
        ? 1
        : 0
  }));

  if (historyChartInstance) historyChartInstance.destroy();

  historyChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label: `Histórico de Status para ${entidade}`,
          data: dadosParaGrafico,
          borderColor: "#3498db",
          backgroundColor: "rgba(52, 152, 219, 0.2)",
          fill: true,
          stepped: true
        }
      ]
    },
    options: {
      responsive: true,
      parsing: false,
      scales: {
        x: {
          type: "time",
          time: { tooltipFormat: "dd/MM/yyyy HH:mm" },
          title: {
            display: true,
            text: "Data"
          }
        },
        y: {
          min: 0,
          max: 1,
          ticks: {
            stepSize: 1,
            callback: (value) => {
              if (value === 1) return "OK";
              if (value === 0) return "Com falha";
              return value;
            }
          },
          title: { display: true, text: "Status" }
        }
      }
    }
  });
}

/* Modal de prints */

function configurarModalPrint() {
  document.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", fecharModalPrint);
  });
}

function abrirModalPrint(src) {
  const modal = document.getElementById("modalPrint");
  const img = document.getElementById("modalPrintImg");
  img.src = src;
  modal.classList.add("open");
}

function fecharModalPrint() {
  const modal = document.getElementById("modalPrint");
  modal.classList.remove("open");
}
