const ytDlp = require('yt-dlp-exec');

async function test() {
  try {
    console.log("Starting yt-dlp test...");
    await ytDlp('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
      dumpJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
    });
    console.log("Success!");
  } catch (err) {
    console.log("Error type:", typeof err);
    console.log("Error keys:", Object.keys(err));
    console.log("Error message:", err.message);
    console.log("Error stderr:", err.stderr);
  }
}

test();
