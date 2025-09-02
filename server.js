const fs = require("fs");
const csv = require("csv-parser");

const INPUT_CSV = "a.csv";

const services = {};

fs.createReadStream(INPUT_CSV)
  .pipe(csv())
  .on("data", (row) => {
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
  })
  .on("end", () => {
    const output = Object.values(services);
    console.log(JSON.stringify(output, null, 2));
  });
