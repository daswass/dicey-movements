const webpush = require("web-push");
const fs = require("fs");
const path = require("path");

// Read existing .env file to get the email
let userEmail = "mailto:your-actual-email@example.com";
try {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const emailMatch = envContent.match(/VAPID_EMAIL=mailto:(.+)/);
    if (emailMatch) {
      userEmail = `mailto:${emailMatch[1]}`;
    }
  }
} catch (error) {
  console.log("Could not read existing .env file, using default email");
}

// Generate VAPID keys
const vapidKeys = webpush.generateVAPIDKeys();

console.log("VAPID Keys Generated:");
console.log("=====================");
console.log("Public Key:", vapidKeys.publicKey);
console.log("Private Key:", vapidKeys.privateKey);
console.log("");
console.log("Add these to your environment variables:");
console.log("VAPID_PUBLIC_KEY=" + vapidKeys.publicKey);
console.log("VAPID_PRIVATE_KEY=" + vapidKeys.privateKey);
console.log("VAPID_EMAIL=" + userEmail);
console.log("");
console.log("Using email from .env:", userEmail);
