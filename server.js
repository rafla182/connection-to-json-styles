const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "1mb" }));

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Arquivo não enviado" });

  const services = {};
  const filepath = req.file.path;

  fs.createReadStream(filepath)
    .pipe(csv())
    .on("data", (row) => {
      const key = row.key;
      if (!services[key]) {
        services[key] = {
          // Não incluir service_id aqui diretamente:
          key: row.key,
          icon: row.icon,
          logo: row.logo,
          title: row.title,
          category: row.category,
          managedByTuna: row.managedByTuna.toLowerCase() === "true",
          details: [],

          // Guardar service_id em propriedade interna para uso interno
          _service_id: row.service_id,
        };
      }

      let tags = [];
      if (row["details.tags"]) {
        tags = row["details.tags"]
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }

      services[key].details.push({
        lane: row["details.lane"] || null,
        tags,
      });
    })
    .on("end", () => {
      fs.unlinkSync(filepath);

      // Gerar resultado sem _service_id para JSON
      const result = Object.values(services).map(({ _service_id, ...rest }) => rest);

      // Gerar updates usando _service_id do original
      const updates = Object.values(services).map(service => {
        const stylesJson = JSON.stringify({
          key: service.key,
          icon: service.icon,
          logo: service.logo,
          title: service.title,
          category: service.category,
          managedByTuna: service.managedByTuna,
          details: service.details,
        });
        const escapedStyles = stylesJson.replace(/'/g, "''");
        return `UPDATE payment.service\nSET styles='${escapedStyles}'\nWHERE service_id=${service._service_id};`;
      });

      res.json({ data: result, sql_updates: updates });
    })
    .on("error", (err) => {
      console.error("Erro ao processar CSV:", err);
      res.status(500).json({ error: "Erro ao processar CSV" });
    });
});

app.post("/upload-string", (req, res) => {
  const { csv } = req.body;
  if (!csv || typeof csv !== "string") {
    return res.status(400).json({ error: "String CSV não enviada" });
  }

  // Defina a ordem esperada das colunas
  const columns = [
    "service_id",
    "key",
    "icon",
    "logo",
    "title",
    "category",
    "managedByTuna",
    "details.lane",
    "details.tags"
  ];

  // Aceita múltiplas linhas separadas por \n
  const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const services = {};

  for (const line of lines) {
    // Suporta tabulação ou vírgula como separador
    const parts = line.split(/,(?![^\t]*\t)|\t/).map(p => p.trim());
    if (parts.length < columns.length) continue;

    const row = {};
    columns.forEach((col, idx) => {
      row[col] = parts[idx] || "";
    });

    const key = row.key;
    if (!services[key]) {
      services[key] = {
        key: row.key,
        icon: row.icon,
        logo: row.logo,
        title: row.title,
        category: row.category,
        managedByTuna: row.managedByTuna.toLowerCase() === "true",
        details: [],
        _service_id: row.service_id,
      };
    }

    let tags = [];
    if (row["details.tags"]) {
      tags = row["details.tags"]
        .split(";")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    services[key].details.push({
      lane: row["details.lane"] || null,
      tags,
    });
  }

  // Gerar resultado sem _service_id para JSON
  const result = Object.values(services).map(({ _service_id, ...rest }) => rest);

  // Gerar updates usando _service_id do original
  const updates = Object.values(services).map(service => {
    const stylesJson = JSON.stringify({
      key: service.key,
      icon: service.icon,
      logo: service.logo,
      title: service.title,
      category: service.category,
      managedByTuna: service.managedByTuna,
      details: service.details,
    });
    const escapedStyles = stylesJson.replace(/'/g, "''");
    return `UPDATE payment.service\nSET styles='${escapedStyles}'\nWHERE service_id=${service._service_id};`;
  });

  res.json({ data: result, sql_updates: updates });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
