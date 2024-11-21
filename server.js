const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const app = express();
const { Pool } = require('pg');
const PORT = process.env.PORT || 3000;
const crypto = require('crypto');

// @author jhonbraynrafer
// Initialize PostgreSQL client
const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://delmundo:fB3Yq3XuVZnRfDA_9oEFAQ@phased-moth-7387.g8z.gcp-us-east1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full',
  ssl: {
    rejectUnauthorized: false, 
  },
});
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://delmundo:fB3Yq3XuVZnRfDA_9oEFAQ@phased-moth-7387.g8z.gcp-us-east1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full',
  ssl: {
    rejectUnauthorized: false, 
  },
});

// Connect to the PostgreSQL database
client.connect()
  .then(() => console.log('PostgreSQL client connected successfully'))
  .catch(err => console.error('Connection error', err.stack));

// Middleware
app.use(express.json());
app.use(cors()); // Enable CORS for all origins





//delete students

app.delete("/api/students/:email", async (req, res) => {
  const { email } = req.params;
  try {
    const result = await client.query("DELETE FROM students WHERE email = $1", [email]);

    if (result.rowCount === 0) {
      return res.status(404).send("Student not found");
    }

    res.send("Student Deleted");
  } catch (error) {
    console.error("Error deleting Student:", error);
    res.status(500).send("Internal Server Error");
  }
});




// Fetch all students
app.get('/api/students', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM students ORDER BY last_Name');
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ error: 'Failed to fetch students', details: error.message });
  }
});



const transporter = nodemailer.createTransport({
  service: 'Gmail', // You can use 'Gmail', 'Outlook', etc., or configure an SMTP server
  auth: {
    user: 'mcsaliksik@gmail.com',
    pass: 'vubpgxhfuvwbnvde',
  },
});

// Function to send email
const sendEmail = async (to, subject, text,html) => {
  const mailOptions = {
    from: 'mcsaliksik@gmail.com', // Update this to the sender email
    to: to,
    subject: subject,
    text: text,
    html: html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
  }
};








//research insert
app.post("/api/research", async (req, res) => {
  const { title, keyword,year, url } = req.body; // 'url' refers to the abstract_url

  try {
    // Using client to insert research data into the database
    await client.query(
      "INSERT INTO research_repository (title,keyword,year, abstract_url) VALUES ($1,$2, $3, $4)",
      [title, keyword,year, url]
    );

    res.status(201).send("Research added");
  } catch (error) {
    console.error("Error adding research:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//delete
app.delete("/api/research/:title", async (req, res) => {
  const { title } = req.params;
  try {
    const result = await client.query("DELETE FROM research_repository WHERE id = $1", [title]);

    if (result.rowCount === 0) {
      return res.status(404).send("Book not found");
    }

    res.send("Book deleted");
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).send("Internal Server Error");
  }
});

//fetch

app.get("/api/research", async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM research_repository ORDER BY title");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.put("/api/research/:book_id", async (req, res) => {
  const bookId = req.params.book_id; // Current book_id from params
  const { title, keyword,year, pdf_url } = req.body; // Include the necessary fields in the request body

  try {
    // Update the book in the books table (including URL)
    const result = await client.query(
      "UPDATE research_repository SET title = $1, keyword = $2,year = $3, abstract_url = $4 WHERE id = $5",
      [title, keyword,year, pdf_url, bookId] // Use bookId here
    );

    // Check if the book was found and updated
    if (result.rowCount === 0) {
      return res.status(404).send("Book not found");
    }

    // Send back a success message or the updated book information
    res.send({ message: "Book updated successfully" });
  } catch (error) {
    console.error("Error updating book:", error);
    res.status(500).send("Internal Server Error");
  }
});






//insert students bulk
app.post('/api/insert_students', async (req, res) => {
  const students = req.body.students; // Assume 'students' is an array of student objects
  const Enrolled_status = true;

  try {
    const values = students.map((student) => {
      const { email, First_Name, Last_Name } = student;
      const password = crypto.randomBytes(8).toString('hex');
      return [email, First_Name, Last_Name, password, Enrolled_status];
    });

    const query = `
      INSERT INTO students (email, first_name, last_name, password, enrolled) 
      VALUES ${values.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(', ')}
    `;

    const flattenedValues = values.flat();
    await client.query(query, flattenedValues);

 // Send an email to each student with their login credentials
for (const [email, firstName, lastName, password] of values) {
  const subject = 'Your Account for MC Salik-Sik Library System';
  const html = `
    <p>Dear ${firstName} ${lastName},</p>
    <p>Your account has been created successfully. You can now log in using the following credentials:</p>
    <p><strong>Email:</strong> ${email}<br><strong>Password:</strong> ${password}</p>
    <p>Please keep this information secure.</p>
    <p><a href="https://mc-salik-sik.vercel.app/" style="padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Open the Website</a></p>
    <p>Best regards,<br>MC Salik-Sik Library System Team</p>
  `;

  await sendEmail(email, subject,null, html);
}

    res.status(201).send('Students added and emails sent successfully');
  } catch (error) {
    console.error('Error adding students:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
   
    const result = await pool.query(
      'SELECT * FROM public.students WHERE email = $1 AND password = $2 AND enrolled = TRUE',
      [email, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials or not enrolled' });
    }

    res.json({ message: 'Login successful', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


app.post('/api/research/bulk', async (req, res) => {
  const { researchList } = req.body;

  if (!Array.isArray(researchList) || researchList.length === 0) {
    return res.status(400).json({ error: 'Invalid research list.' });
  }

  const queries = researchList.map(
    (r) => `('${r.title}', '${r.keyword}', '${r.year}', '${r.url}')`
  ).join(',');

  const insertQuery = `
    INSERT INTO research_repository (title, keyword, year, abstract_url)
    VALUES ${queries}
  `;

  try {
    await pool.query(insertQuery);
    res.status(201).json({ message: 'Research data added successfully.' });
  } catch (err) {
    console.error('Error inserting data:', err);
    res.status(500).json({ error: 'Failed to add research data.' });
  }
});


app.use((req, res, next) => {
  console.log(`${req.method} request to ${req.url}`);
  next();
});

// Basic route
app.get('/', (req, res) => {
  res.send('Hello! The server is running.');
});

// Print "Server is live" every 40 seconds
setInterval(() => {
  console.log('Server is live');
}, 40000);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
