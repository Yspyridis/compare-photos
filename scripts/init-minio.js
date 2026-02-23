const { S3Client, CreateBucketCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: "http://localhost:9000",
  forcePathStyle: true,
  credentials: {
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadmin",
  },
});

async function init() {
  const bucketName = "blind-uploads";

  try {
    console.log(`Checking/Creating bucket: ${bucketName}...`);
    await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
    console.log("✅ Bucket created successfully!");
  } catch (err) {
    // Ignore error if bucket already exists
    if (
      err.name === "BucketAlreadyOwnedByYou" ||
      err.name === "BucketAlreadyExists"
    ) {
      console.log("✅ Bucket already exists.");
    } else {
      console.error("❌ Error creating bucket:", err);
    }
  }
}

init();
