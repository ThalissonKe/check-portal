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

// 0 = Erro/sem dados, 1 = Alerta, 2 = OK
function statusToLevel(alerta) {
  if (alerta === "OK") return 2;
  if (alerta === "Poucos registros") return 1;
  // "Sem dados", "Erro", "Erro Crítico", etc.
  return 0;
}

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
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Quantidade de portais",
          data: valores,
          backgroundColor: backgroundColors,
          borderRadius: 6,
          maxBarThickness: 26
        }
      ]
    },
    options: {
      indexAxis: "y", // deixa horizontal
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Distribuição de Status (Última Verificação)"
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.x} portal(is)`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            precision: 0
          },
          title: {
            display: true,
            text: "Quantidade de portais"
          }
        },
        y: {
          title: {
            display: true,
            text: "Alerta"
          }
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

  // Início da SEMANA ATUAL: domingo
  const inicioSemana = new Date(hoje);
  const diaSemana = inicioSemana.getDay(); // 0 = Dom, 6 = Sáb
  inicioSemana.setDate(inicioSemana.getDate() - diaSemana);
  inicioSemana.setHours(0, 0, 0, 0);

  // Fim da semana: sábado
  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(fimSemana.getDate() + 6);
  fimSemana.setHours(23, 59, 59, 999);

  const umDiaMs = 24 * 60 * 60 * 1000;

  // Filtra registros da entidade só na semana atual
  const dadosFiltrados = dadosHistorico.filter((item) => {
    const dataItem = parseData(item["Data/Hora"]);
    return (
      item["Município"] === entidade &&
      dataItem >= inicioSemana &&
      dataItem <= fimSemana
    );
  });

  // Mapa: chave = YYYY-MM-DD, valor = pior nível do dia (0 <= 1 <= 2)
  const mapaDiaNivel = new Map();

  dadosFiltrados.forEach((item) => {
    const d = parseData(item["Data/Hora"]);
    const diaChave = d.toISOString().slice(0, 10); // "2025-11-24"
    const nivel = statusToLevel(item["Alerta"]);

    const atual = mapaDiaNivel.get(diaChave);
    // guardamos o "pior" status do dia (menor nível)
    if (atual === undefined || nivel < atual.nivel) {
      mapaDiaNivel.set(diaChave, { nivel, data: d });
    }
  });

  // Monta os 7 dias da semana (Dom..Sáb)
  const datas = [];
  for (
    let d = new Date(inicioSemana), idx = 0;
    d <= fimSemana;
    d = new Date(d.getTime() + umDiaMs), idx++
  ) {
    const diaChave = d.toISOString().slice(0, 10);
    const info = mapaDiaNivel.get(diaChave);
    const nivel = info ? info.nivel : null;

    datas.push({
      x: idx,       // 0..6
      y: 0,         // única linha ("Semana")
      v: nivel,
      date: new Date(d)
    });
  }

  if (historyChartInstance) historyChartInstance.destroy();

  const diasLabel = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  historyChartInstance = new Chart(ctx, {
    type: "matrix",
    data: {
      datasets: [
        {
          label: `Histórico de Status para ${entidade}`,
          data: datas,
          backgroundColor: (ctx) => {
            const value = ctx.raw.v;
            if (value === null) return "rgba(148, 163, 184, 0.2)"; // sem verificação
            if (value === 2) return "rgba(34, 197, 94, 0.8)";      // OK
            if (value === 1) return "rgba(249, 115, 22, 0.8)";     // Poucos registros
            return "rgba(239, 68, 68, 0.85)";                      // Erro / Sem dados
          },
          borderWidth: 1,
          borderColor: "rgba(148, 163, 184, 0.4)",
          width: (ctx) => {
            const area = ctx.chart.chartArea;
            return area ? area.width / 7 - 4 : 24;
          },
          height: (ctx) => {
            const area = ctx.chart.chartArea;
            return area ? area.height - 4 : 24;
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const raw = items[0].raw;
              return raw.date.toLocaleDateString("pt-BR");
            },
            label: (items) => {
              const v = items.raw.v;
              if (v === null) return "Sem verificação";
              if (v === 2) return "OK";
              if (v === 1) return "Poucos registros";
              return "Erro / Sem dados";
            }
          }
        },
        title: {
          display: false
        }
      },
      scales: {
        x: {
          type: "linear",
          position: "bottom",
          min: -0.5,
          max: 6.5,
          ticks: {
            stepSize: 1,
            callback: (value) => diasLabel[value] ?? ""
          },
          title: {
            display: true,
            text: "Semana atual (Dom a Sáb)"
          },
          offset: true
        },
        y: {
          type: "category",
          labels: ["Semana"],
          title: {
            display: false
          },
          offset: true
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
