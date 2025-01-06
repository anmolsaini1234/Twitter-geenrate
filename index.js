const express = require("express");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.post("/generate-video", async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).send("Text is required!");
  }

  const framesDir = path.join(__dirname, "frames");
  const outputVideo = path.join(__dirname, "output.mp4");

  // Create frames directory if it doesn't exist
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir);
  }

  try {
    // Launch Puppeteer to render the typing effect
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set up HTML content for typing effect with line breaks
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Typing Effect</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: black;
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: monospace;
            white-space: pre-wrap;  /* Preserve line breaks */
          }
          .typing-container {
            font-size: 24px;
            border-right: 2px solid white;
            animation: blink-caret 0.7s step-end infinite;
          }
          @keyframes blink-caret {
            from, to { border-color: transparent; }
            50% { border-color: white; }
          }
        </style>
      </head>
      <body>
        <div id="text-container" class="typing-container">${text}</div>
        <script>
          const container = document.getElementById("text-container");
          let i = 0;
          let textContent = container.textContent;
          container.textContent = '';  // Clear initial content

          function typeWriter() {
            if (i < textContent.length) {
              container.textContent += textContent.charAt(i);  // Add one character at a time
              i++;
              setTimeout(typeWriter, 100);  // Adjust speed of typing effect
            }
          }
          typeWriter();  // Start typing effect
        </script>
      </body>
      </html>
    `);

    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for animation to start

    // Capture frames for the typing effect
    for (let frame = 0; frame < text.length; frame++) {
      const framePath = path.join(framesDir, `frame-${frame.toString().padStart(4, "0")}.png`);
      await page.screenshot({ path: framePath });
    }

    await browser.close();

    // Generate the video using FFmpeg
    exec(
      `ffmpeg -framerate 10 -i "${path.join(framesDir, 'frame-%04d.png')}" -c:v libx264 -pix_fmt yuv420p "${outputVideo}"`,
      (error, stdout, stderr) => {
        if (error) {
          console.error("FFmpeg error:", stderr);
          return res.status(500).send("Video generation failed.");
        }

        // Send video as download
        res.download(outputVideo, () => {
          // Clean up frames and video file after sending the video
          fs.rmSync(framesDir, { recursive: true, force: true });
          fs.unlinkSync(outputVideo);
        });
      }
    );
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).send("Server error.");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
