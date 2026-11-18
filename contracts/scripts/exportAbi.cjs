const fs = require('node:fs');
const path = require('node:path');
const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'FlightSure.sol', 'FlightSure.json');
const outputPath = path.join(__dirname, '..', '..', 'src', 'chain', 'FlightSure.json');

async function main() {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact.abi, null, 2)}\n`);
  console.log(`Exported FlightSure ABI to ${outputPath}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
