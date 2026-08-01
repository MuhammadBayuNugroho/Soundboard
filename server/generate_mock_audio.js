import fs from 'fs';
import path from 'path';

const mockDriveDir = path.resolve(__dirname, './mock_drive');

if (!fs.existsSync(mockDriveDir)) {
  fs.mkdirSync(mockDriveDir, { recursive: true });
}

function generateSilentWav(filename, durationSeconds) {
  const sampleRate = 8000;
  const bitsPerSample = 8;
  const numChannels = 1;
  const dataSize = sampleRate * durationSeconds * (bitsPerSample / 8);
  const chunkSize = 36 + dataSize;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(chunkSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20);  // AudioFormat (PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write silent PCM data (8-bit silence is represented by 128)
  buffer.fill(128, 44);

  const filePath = path.join(mockDriveDir, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated silent WAV: ${filename} (${durationSeconds}s) -> ${filePath}`);
}

const mockFiles = [
  { name: 'op_opening_theme.wav', duration: 15 },
  { name: 'mars_sacp_official.wav', duration: 25 },
  { name: 'shl_sholawat_badar.wav', duration: 20 },
  { name: 'fx_boom.wav', duration: 2 },
  { name: 'fx_applause.wav', duration: 5 },
  { name: 'fx_bell.wav', duration: 3 },
  { name: 'cl_closing_tribute.wav', duration: 12 },
  { name: 'bg_instrument_ambient.wav', duration: 30 }
];

mockFiles.forEach(file => {
  generateSilentWav(file.name, file.duration);
});
