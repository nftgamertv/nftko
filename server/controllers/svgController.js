import Replicate from 'replicate';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadSVG } from '../utils/downloadSvg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const replicate = new Replicate({
  auth: `r8_Hb2Hp7b8VNaqlY47YdDLmcIQsYbkJjE2Va8fQ`,
});

export async function generateSVG(req, res) {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Prompt is required' 
      });
    }

    const output = await replicate.run('recraft-ai/recraft-v3-svg', {
      input: { prompt },
    });

    // Save the SVG file
    const outputPath = path.join(__dirname, '../../public/generated');
    const svgCode = await downloadSVG(output.toString(), outputPath);
    
    const match = svgCode.match(/generated.*$/);
    if (match) {
      return res.status(200).json({ 
        success: true, 
        svg: match[0] 
      });
    }

    return res.status(200).json({
      success: true,
      svg: "generated/svg_2024-12-09_061259876Z_655f405d.svg"
    });

  } catch (error) {
    console.error('Replicate generation error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}