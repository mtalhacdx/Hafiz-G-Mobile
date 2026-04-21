const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const env = require("../src/config/env");
const Admin = require("../src/models/Admin");

const parseArgs = (argv) => {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
};

const printUsage = () => {
  console.log("Usage:");
  console.log("node scripts/create-admin.js --username owner --password \"StrongPass123\" --name \"Owner Admin\" [--email owner@example.com]");
};

const normalize = (value) => String(value || "").trim();

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const username = normalize(args.username).toLowerCase();
  const password = normalize(args.password);
  const name = normalize(args.name) || "Owner Admin";
  const emailRaw = normalize(args.email).toLowerCase();
  const email = emailRaw || null;

  if (!username || !password) {
    printUsage();
    throw new Error("username and password are required");
  }

  if (password.length < 8) {
    throw new Error("password must be at least 8 characters");
  }

  await mongoose.connect(env.mongodbUri);

  try {
    const [existingByUsername, existingByEmail] = await Promise.all([
      Admin.findOne({ username }).select("_id username"),
      email ? Admin.findOne({ email }).select("_id email") : null,
    ]);

    if (existingByUsername) {
      throw new Error("username already exists");
    }

    if (existingByEmail) {
      throw new Error("email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      name,
      username,
      email,
      passwordHash,
      role: "admin",
      isActive: true,
    });

    console.log(
      JSON.stringify(
        {
          success: true,
          id: String(admin._id),
          username: admin.username,
          email: admin.email,
          role: admin.role,
          isActive: admin.isActive,
        },
        null,
        2
      )
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Create admin failed:", error.message);
  process.exitCode = 1;
});
