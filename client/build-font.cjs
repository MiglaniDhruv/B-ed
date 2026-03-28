const fs = require("fs");
const path = require("path");

const fontPath = path.join(__dirname, "src/lib/fonts/NotoSansGujarati-Regular.ttf");
const outputPath = path.join(__dirname, "src/lib/fonts/gujarati-font.js");

if (!fs.existsSync(fontPath)) {
  console.log("Font file not found at:", fontPath);
  process.exit(1);
}

const font = fs.readFileSync(fontPath);
const base64 = font.toString("base64");

const fileContent = `
export default {
  "NotoSansGujarati-Regular.ttf": "${base64}"
};
`;

fs.writeFileSync(outputPath, fileContent);

console.log("Gujarati font converted successfully.");