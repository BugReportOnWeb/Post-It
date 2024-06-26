import { pool } from "../database/db";
import { compare, hash } from "bcrypt";
import { createToken } from "../lib/token";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { QueryResult } from "pg";
import type { UserDataType } from "../types/user";
import type { LoginUserConfig, RegisterUserConfig, LoginResponseType, RegisterResponseType, ErrorResponseType, UpdateUserProfile } from "../types/auth";

const getUserData = async (req: FastifyRequest, res: FastifyReply): Promise<UserDataType | ErrorResponseType> => {
  try {
    const email = req.email as string;
    const username = req.username as string;

    const userData: QueryResult = await pool.query("SELECT username, first_name, middle_name, last_name, email, registered_on FROM users WHERE email = $1 AND username = $2", [email as string, username as string]);

    if (userData.rows.length === 0) {
      return res.status(402).send({ error: "Unauthorized Access." });
    }

    const userObj: UserDataType = {
      admin: req.isAdmin ?? false,
      ...userData.rows[0]
    }

    return res.send(userObj);
  } catch (error) {
    return res.status(500).send({ error: "Internal Server Error" });
  }
}

// register an user
const registerUser = async (req: FastifyRequest<{ Body: RegisterUserConfig }>, res: FastifyReply): Promise<RegisterResponseType | ErrorResponseType> => {
  try {
    // TODO: Refactor/style some stuff here
    let { username, firstName, middleName, lastName, email, password, confirmPassword }: RegisterUserConfig = req.body;

    // check if any field is missing
    if (!username || !firstName || !email || !password || !confirmPassword) {
      return res.status(400).send({ error: "Require all fields (username, firstName, email, password, confirmPassword)." })
    }

    // trim all fields
    username = username.trim() as string;
    firstName = firstName.trim() as string;
    middleName = middleName?.trim() as string || null;
    lastName = lastName?.trim() as string || null;
    email = email.trim() as string;
    email = String(email).toLowerCase();
    password = password.trim() as string;
    confirmPassword = confirmPassword.trim() as string;

    // Validate password 
    if (!validatePassword(password as string) || (password.length < 8 || password.length > 50)) {
      return res.status(403).send({ error: "Password should contains atleast one (special character, uppercase character, lowercase character, number) & character limit is: [8, 50]" })
    }

    // Validate email format
    if (!validateEmail(email as string)) {
      return res.status(403).send({ error: "Invalid email format." });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).send({ error: "Passwords do not match." });
    }

    // Check if user already exists
    const existingUserWithEmail: QueryResult<{ email: string }> = await pool.query(
      "SELECT email FROM users WHERE email = $1",
      [email as string]
    );

    const existingUserWithUsername: QueryResult<{ username: string }> = await pool.query(
      "SELECT username FROM users WHERE username = $1",
      [username as string]
    );

    if (existingUserWithEmail.rows.length > 0 || existingUserWithUsername.rows.length > 0) {
      return res.status(409).send({ error: "User already exists." });
    }

    // Hash the password
    const hashedPassword: string = await hash(password, 12) as string;

    await pool.query(
      "INSERT INTO users (username, first_name, middle_name, last_name, email, password) VALUES ($1, $2, $3, $4, $5, $6)",
      [username as string, firstName as string, middleName as string, lastName as string, email as string, hashedPassword as string]
    );

    const token: string = createToken(email, username);

    res.status(200).send({
      message: "User registered successfully.",
      username: username as string,
      token: token as string
    });

    const response: RegisterResponseType = {
      message: "User registered successfully.",
      username: username as string,
      email: email as string,
      token: token as string
    }

    return res.status(200).send(response);
  } catch (error) {
    if (error instanceof Error) console.error(error.message);
    return res.status(500).send({ error: "Internal Server Error" });
  }
}

const loginUser = async (req: FastifyRequest<{ Body: LoginUserConfig }>, res: FastifyReply): Promise<LoginResponseType | ErrorResponseType> => {
  const { username, email, password } = req.body;

  if (!username && !email) {
    const error = 'Enter either your username or email to login';
    return res.status(400).send({ error: error });
  }

  try {
    // Setting DB attribute name and value from available field in req.body
    const userAttr = username ? 'username' : 'email';
    const userAttrValue = username ? username : email as string;

    const result: QueryResult<{ username: string, email: string, password: string }> = await pool.query(
      `SELECT username, email, password FROM users WHERE ${userAttr} = $1`,
      [userAttrValue as string]
    );
    const user = result.rows[0];

    if (!user) {
      const error = "User not found.";
      return res.status(404).send({ error: error });
    }

    const correctPassword = await compare(password, user.password);

    if (!correctPassword) {
      const error = "Incorrect Password";
      return res.status(401).send({ error: error });
    }

    // Sucessfull login
    const token = createToken(user.email, user.username);
    const response = {
      message: 'User logged in successfully',
      username: user.username as string,
      email: user.email as string,
      token: token as string,
    }

    return res.send(response);
  } catch (error) {
    if (error instanceof Error) console.error(error.message);
    return res.status(500).send({ error: "Internal Server Error" });
  }
}

// update user profile
const updateProfile = async (req: FastifyRequest<{ Body: UpdateUserProfile }>, res: FastifyReply): Promise<void> => {
  const email = req.email;
  const username = req.username;
  try {
    // TODO: Refactor/style some stuff here
    let { firstName, middleName, lastName, updated_email, currPassword, newPassword, confirmNewPassword } = req.body;

    // trim all fields
    firstName = firstName?.trim() as string;
    middleName = middleName?.trim() as string || null;
    lastName = lastName?.trim() as string || null;
    updated_email = updated_email?.trim() as string;
    updated_email = String(updated_email).toLowerCase();
    newPassword = newPassword?.trim() as string;
    confirmNewPassword = confirmNewPassword?.trim() as string;

    // Check if user exists
    let existingUser: QueryResult = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username as string],
    );

    if (validatePassword(newPassword) && (newPassword === confirmNewPassword)) {
      if (!validatePassword(newPassword as string) || (newPassword.length < 8 || newPassword.length > 50)) {
        return res.status(403).send({ error: "Password should contains atleast one (special character, uppercase character, lowercase character, number) & character limit is: [8, 50]" })
      }

      const user = existingUser.rows[0];
      const isPasswordCorrect: boolean = await compare(currPassword, user.password);

      if (!isPasswordCorrect) {
        return res.status(401).send({ error: "Incorrect password." });
      }

      const hashedPassword: string = await hash(newPassword, 12);
      const update_user_password: QueryResult = await pool.query("UPDATE users SET password = $1 WHERE username = $2", [hashedPassword as string, username as string]);

      if (update_user_password) {
        return res.status(200).send({
          message: "Password updated successfully.",
        })
      }
    } else if (typeof (updated_email) === 'string' && email != updated_email && updated_email !== 'undefined') {
      // Validate email format
      if (!validateEmail(updated_email as string)) {
        return res.status(403).send({ error: "Invalid email format." });
      }

      const user = existingUser.rows[0];

      const isPasswordCorrect: boolean = await compare(currPassword, user.password);

      if (!isPasswordCorrect) {
        return res.status(401).send({ error: "Incorrect password." });
      }

      const update_user_email: QueryResult = await pool.query("UPDATE users SET email = $1 WHERE username = $2", [updated_email as string, username as string]);

      if (update_user_email) {
        const token: string = createToken(updated_email, username);
        return res.status(200).send({
          message: "Email updated successfully.",
          username: user.user_username,
          email: updated_email,
          token: token,
        })
      }
    } else if (firstName || middleName || lastName) {

      const user = existingUser.rows[0];
      if (user.first_name != firstName && firstName !== 'undefined') {
        await pool.query("UPDATE users SET first_name = $1 WHERE username = $2", [firstName as string, username as string]);
      } else if (user.middleName != middleName && middleName !== 'undefined') {
        await pool.query("UPDATE users SET middle_name = $1 WHERE username = $2", [middleName as string, username as string]);
      } else if (user.lastName != lastName && lastName !== 'undefined') {
        await pool.query("UPDATE users SET last_name = $1 WHERE username = $2", [lastName as string, username as string]);
      }
      return res.status(200).send({
        message: "Name updated successfully.",
        username: username,
      })
    }

    return res.status(404).send({ error: "Wrong request, Check again." });

  } catch (error) {
    if (error instanceof Error) console.error(error.message);
    return res.status(500).send({ error: "Internal Server Error" });
  }
}

// Validate password
function validatePassword(pw: string): boolean {
  return /[A-Z]/.test(pw) &&
    /[a-z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[\W_]/.test(pw) &&
    pw.length > 4;
}

// Validate email address
const validateEmail = (email: string): boolean => {
  const re =
    /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
  return re.test(String(email).toLowerCase());
};

export { registerUser, loginUser, updateProfile, getUserData };
