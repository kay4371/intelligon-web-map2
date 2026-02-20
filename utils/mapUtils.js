// utils/mapUtils.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Convert and return image buffer of the highlighted SVG map
async function getHighlightedMapBuffer(affectedIds = []) {
  const svgPath = path.join(__dirname, '../public/nigeria-map.svg');
  let svgContent = fs.readFileSync(svgPath, 'utf8');

  affectedIds.forEach(id => {
    const regex = new RegExp(`(<path[^>]*id="${id}"[^>]*)(/?>)`, 'i');
    svgContent = svgContent.replace(regex, `$1 style="fill:#FF5733;stroke:#900C3F;stroke-width:2;"$2`);
  });

  return await sharp(Buffer.from(svgContent))
    .resize(500)
    .png()
    .toBuffer();
}

function stateNameToId(name) {
  const map = {
    Abia: 'NG-AB', Adamawa: 'NG-AD', AkwaIbom: 'NG-AK', Anambra: 'NG-AN', Bauchi: 'NG-BA',
    Bayelsa: 'NG-BY', Benue: 'NG-BE', Borno: 'NG-BO', CrossRiver: 'NG-CR', Delta: 'NG-DE',
    Ebonyi: 'NG-EB', Edo: 'NG-ED', Ekiti: 'NG-EK', Enugu: 'NG-EN', Gombe: 'NG-GO',
    Imo: 'NG-IM', Jigawa: 'NG-JI', Kaduna: 'NG-KD', Kano: 'NG-KN', Katsina: 'NG-KT',
    Kebbi: 'NG-KE', Kogi: 'NG-KO', Kwara: 'NG-KW', Lagos: 'NG-LA', Nasarawa: 'NG-NA',
    Niger: 'NG-NI', Ogun: 'NG-OG', Ondo: 'NG-ON', Osun: 'NG-OS', Oyo: 'NG-OY',
    Plateau: 'NG-PL', Rivers: 'NG-RI', Sokoto: 'NG-SO', Taraba: 'NG-TA', Yobe: 'NG-YO',
    Zamfara: 'NG-ZA', FCT: 'NG-FC'
  };
  return map[name.replace(/\s+/g, '')] || '';
}

module.exports = {
  getHighlightedMapBuffer,
  stateNameToId
};
