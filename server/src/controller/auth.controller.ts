import { pool } from "../database/db";
import { createUserTable } from "../database/users";
import { hash } from "bcrypt";
import { createToken } from "../lib/token";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { RegisterUserConfig } from "../types/auth";
import type { QueryResult } from "pg";

// register an user
const registerUser = async (req: FastifyRequest<{ Body: RegisterUserConfig }>, res: FastifyReply) => {

  try {
    console.warn("DEBUGPRINT[2]: auth.controller.ts:13: req=", req.body);

    let { username, first_name, middle_name, last_name, email, password, confirmPassword }: RegisterUserConfig = req.body;

    // check if any field is missing
    if (!username || !first_name || !email || !password || !confirmPassword) {
      res.status(400).send({ error: "Require all fields (username, first_name, email, password, confirmPassword)." })
    }

    // trim all fields
    username = username.trim() as string;
    first_name = first_name.trim() as string;
    middle_name = middle_name?.trim() as string || null;
    last_name = last_name?.trim() as string || null;
    email = email.trim() as string;
    password = password.trim() as string;
    confirmPassword = confirmPassword.trim() as string;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).send({ error: "Invalid email format." });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).send({ error: "Passwords do not match." });
    }

    // Ensure the "users" table exists
    await createUserTable();
    // Check if user already exists
    const existingUser_with_email: QueryResult = await pool.query("SELECT * FROM users WHERE email = $1", [email as string]);
    const existingUser_with_username: QueryResult = await pool.query("SELECT * FROM users WHERE username = $1", [username as string]);
    if (existingUser_with_email.rows.length > 0 || existingUser_with_username.rows.length > 0) {
      return res.status(409).send({ error: "User already exists." });
    }

    // hash the password
    const hashedPassword: string = await hash(password, 12) as string;
    await pool.query("INSERT INTO users (username, first_name, middle_name, last_name, email, password, registered_on) VALUES ($1, $2, $3, $4, $5, $6, $7)", [username as string, first_name as string, middle_name as string, last_name as string, email as string, hashedPassword as string, new Date()]);

    const token: string = createToken(email, username);
    // Send success response
    res.status(200).send({
      message: "User registered successfully.",
      username: username as string,
      token: token as string
    });

  } catch (error) {
    res.status(500).send({ error: "Internal Server Error" });
  }
}

export { registerUser };
