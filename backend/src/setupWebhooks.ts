import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Oura API configuration
const OURA_CLIENT_ID = process.env.OURA_CLIENT_ID || "placeholder-client-id";
const OURA_CLIENT_SECRET = process.env.OURA_CLIENT_SECRET || "placeholder-secret";
const OURA_API_BASE_URL = "https://api.ouraring.com/v2";
const OURA_WEBHOOK_URL = process.env.OURA_WEBHOOK_URL || "http://localhost:3000/api/oura/webhook";
const OURA_WEBHOOK_VERIFICATION_TOKEN =
  process.env.OURA_WEBHOOK_VERIFICATION_TOKEN || "placeholder-verification-token";

async function setupWebhooks() {
  if (!OURA_CLIENT_ID || !OURA_CLIENT_SECRET) {
    console.error("❌ Please set OURA_CLIENT_ID and OURA_CLIENT_SECRET environment variables");
    return;
  }

  const dataTypes = ["daily_activity", "daily_readiness", "workout"];

  console.log("🔧 Setting up webhook subscriptions for the application...");
  console.log(`📡 Webhook URL: ${OURA_WEBHOOK_URL}`);
  console.log(`🔑 Using client ID: ${OURA_CLIENT_ID}`);

  for (const dataType of dataTypes) {
    try {
      console.log(`\n📋 Creating subscription for ${dataType}...`);

      const response = await axios.post(
        `${OURA_API_BASE_URL}/webhook/subscription`,
        {
          callback_url: OURA_WEBHOOK_URL,
          verification_token: OURA_WEBHOOK_VERIFICATION_TOKEN,
          event_type: "create",
          data_type: dataType,
        },
        {
          headers: {
            "x-client-id": OURA_CLIENT_ID,
            "x-client-secret": OURA_CLIENT_SECRET,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`✅ Successfully created subscription for ${dataType}`);
      console.log(`   Subscription ID: ${response.data.id}`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        const errorData = error.response.data;
        if (errorData.detail && errorData.detail.includes("already have one subscription")) {
          console.log(`⚠️  Subscription for ${dataType} already exists`);

          // Try to get the existing subscription
          try {
            const existingResponse = await axios.get(`${OURA_API_BASE_URL}/webhook/subscription`, {
              headers: {
                "x-client-id": OURA_CLIENT_ID,
                "x-client-secret": OURA_CLIENT_SECRET,
              },
            });

            const existingSub = existingResponse.data.data?.find(
              (sub: any) => sub.data_type === dataType
            );
            if (existingSub) {
              console.log(`   Existing Subscription ID: ${existingSub.id}`);
            }
          } catch (getError) {
            console.log(`   Could not retrieve existing subscription details`);
          }
        } else {
          console.error(`❌ Failed to create subscription for ${dataType}:`, errorData);
        }
      } else {
        console.error(`❌ Failed to create subscription for ${dataType}:`, error);
      }
    }
  }

  console.log("\n🎉 Webhook setup complete!");
  console.log(
    "📝 Note: These webhooks will receive data for ALL users who connect their Oura accounts"
  );
  console.log("🔍 You can verify the setup by checking your Oura developer dashboard");
}

// Run the setup
setupWebhooks().catch(console.error);
