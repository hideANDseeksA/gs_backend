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



// Endpoint to get all books
app.get("/api/books", async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM book_list ORDER BY title");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Add a new book
app.post("/api/books", async (req, res) => {
  const { title, author, year, url, stocks } = req.body;
  try {
    await client.query("INSERT INTO book_list (title, author, year, url, stocks) VALUES ($1, $2, $3, $4, $5)", [title, author, year, url, stocks]);
    res.status(201).send("Book added");
  } catch (error) {
    console.error("Error adding book:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.put("/api/books/:book_id", async (req, res) => {
  const bookId = req.params.book_id; // Current book_id from params
  const { title, author, year, stocks, url } = req.body; // Include the necessary fields in the request body

  try {
    // Update the book in the books table (including URL)
    const result = await client.query(
      "UPDATE book_list SET title = $1, author = $2, year = $3, stocks = $4, url = $5 WHERE book_id = $6",
      [title, author, year, stocks, url, bookId] // Use bookId here
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
//

app.put("/api/books_decreased/:book_id", async (req, res) => {
  const bookId = req.params.book_id; // Get book_id from params

  try {
    // Decrease the book's stock by 1 and return the updated row
    const result = await client.query(
      "UPDATE book_list SET stocks = stocks - 1 WHERE book_id = $1 RETURNING stocks",
      [bookId]
    );

    // Check if the book was found and if the stock was updated
    if (result.rowCount === 0) {
      return res.status(404).send("Book not found or stock is already 0");
    }

    // Send back the updated stock value
    res.send({ message: "Book stock decreased successfully", updatedStocks: result.rows[0].stocks });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});



// Delete a book
app.delete("/api/books/:title", async (req, res) => {
  const { title } = req.params;
  try {
    const result = await client.query("DELETE FROM book_list WHERE book_id = $1", [title]);

    if (result.rowCount === 0) {
      return res.status(404).send("Book not found");
    }

    res.send("Book deleted");
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Fetch all students
app.get('/api/students', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM students');
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

// Update student verification status and send formal email
app.put('/api/students/:email/verify', async (req, res) => {
  const email = req.params.email;
  const { verify } = req.body;

  try {
    await client.query('UPDATE students SET auth = $1 WHERE email = $2', [verify, email]);

    // Send email notification with formal message
    const emailMessage = verify
      ? `Dear Student,

We are pleased to inform you that your account has been successfully verified in our system. You now have full access to all available resources and services.

Should you have any questions or need further assistance, please feel free to reach out to our support team.

Best regards,
Mc Saliksik`
      : `Dear Student,

We would like to notify you that your account verification  status have been revoked. As a result, your access to certain services may be restricted.

If you believe this is an error or require assistance, please contact our support team for further clarification.

Best regards,
Mc Saliksik`;

    await sendEmail(email, 'Update on Your Verification and Enrollment Status', emailMessage);

    res.status(200).json({ message: verify ? 'Student is verified and enrolled' : 'Verification status updated' });
  } catch (error) {
    console.error('Error updating verification status:', error);
    res.status(500).json({ error: 'Failed to update verification status', details: error.message });
  }
});
app.put('/api/students/:email/enrolled', async (req, res) => {
  const email = req.params.email;
  const { enrolled } = req.body;

  try {
    await client.query('UPDATE students SET  enrolled = $1 WHERE email = $2', [enrolled, email]);

    // Send email notification with formal message
    const emailMessage = enrolled
      ? `Dear Student,

We are pleased to inform you that your account has been successfully  you are now enrolled in our system. You now have full access to all available resources and services.

Should you have any questions or need further assistance, please feel free to reach out to our support team.

Best regards,
Mc Saliksik`
      : `Dear Student,

We would like to notify you that your account  enrollment status have been revoked. As a result, your access to certain services may be restricted.

If you believe this is an error or require assistance, please contact our support team for further clarification.

Best regards,
Mc Saliksik`;

    await sendEmail(email, 'Update on Your Verification and Enrollment Status', emailMessage);

    res.status(200).json({ message: enrolled ? 'Student is verified and enrolled' : 'Verification status updated' });
  } catch (error) {
    console.error('Error updating verification status:', error);
    res.status(500).json({ error: 'Failed to update verification status', details: error.message });
  }
});
// Bulk verify or unverify all students and send formal emails
app.put('/api/students/verifyAll', async (req, res) => {
  const { enrolled } = req.body;

  try {
    await client.query('UPDATE students SET  enrolled = $1', [enrolled]);

    // Fetch all student emails to send bulk notifications
    const result = await client.query('SELECT email FROM students');
    const students = result.rows;

    // Prepare all email notifications concurrently with formal message
    const emailPromises = students.map((student) => {
      const emailMessage = enrolled
        ? `Dear Student,

We are pleased to inform you that your account has been successfully verified and you are now enrolled in our system. You now have full access to all available resources and services.

Should you have any questions or need further assistance, please feel free to reach out to our support team.

Best regards,
Mc Saliksik`
        : `Dear Student,

We would like to notify you that your account verification and enrollment status have been revoked. As a result, your access to certain services may be restricted.

If you believe this is an error or require assistance, please contact our support team for further clarification.

Best regards,
Mc Saliksik`;

      return sendEmail(student.email, 'Update on Your Verification and Enrollment Status', emailMessage);
    });

    // Send all emails concurrently
    await Promise.all(emailPromises);

    res.status(200).json({ message: 'All students updated and notified' });
  } catch (error) {
    console.error('Error updating all students:', error);
    res.status(500).json({ error: error.message });
  }
});



// Fetch all book activities
app.get('/api/bookactivities', async (req, res) => {
  try {
    const result = await client.query("SELECT book_list.*, books_activity.* FROM books_activity INNER JOIN book_list ON books_activity.book_id = book_list.book_id WHERE action_type ='Reserve'");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

//fetch borrowed books
app.get('/api/bookactivities_borrowed', async (req, res) => {
  try {
    const result = await client.query("SELECT book_list.*, books_activity.* FROM books_activity INNER JOIN book_list ON books_activity.book_id = book_list.book_id WHERE action_type ='Borrowed'");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});
// // Update book activity
app.put('/api/bookactivity/:id', async (req, res) => {
  const { id } = req.params;
  const { action_type, book_state } = req.body; // Include book_state in the request body

  try {
    // Update the reservation_status and book_state in the book_activity table
    await client.query(
      'UPDATE books_activity SET status = $1, book_state = $2 WHERE activity_id = $3',
      [action_type, book_state, id]
    );

    // Insert the most recent activity into the book_logs table
    const sql2 = `
      INSERT INTO book_history (book_id, user_email, action_type, action_date, fine, book_state, status)
      SELECT book_id, user_email, action_type, action_date, fine, book_state, status
      FROM books_activity
      WHERE activity_id = $1`;
    await client.query(sql2, [id]);

    res.json({ success: true, message: 'Activity updated and logged successfully' });
  } catch (error) {
    console.error('Error updating activity or inserting into logs:', error);
    res.status(500).json({ success: false, message: 'Error updating activity or logging activity' });
  }
});
app.put('/api/bookactivity_reserve/:id', async (req, res) => {
  const { id } = req.params;
  const { action_type, book_state, user_email,book_title } = req.body; // Include user_email in the request body

  try {
    // Update the reservation_status and book_state in the book_activity table
    await client.query(
      'UPDATE books_activity SET status = $1, book_state = $2 WHERE activity_id = $3',
      [action_type, book_state, id]
    );

    // Insert the most recent activity into the book_logs table
    const sql2 = `
      INSERT INTO book_history (book_id, user_email, action_type, action_date, fine, book_state, status)
      SELECT book_id, $1, action_type, action_date, fine, book_state, status
      FROM books_activity
      WHERE activity_id = $2`;
    await client.query(sql2, [user_email, id]);

    // Send email if the status is 'Approved'
    if (action_type === 'Approved') {
      // Send a formal email notification
      const mailOptions = {
        from: 'mcsaliksik@gmail.com', // sender address
        to: user_email,
        subject: 'MC Salik-sik: Book Approval Notice' + book_title,
        text: `
        Dear Students,

We are pleased to inform you that your book reservation  has been officially approved by MC Salik-sik.

Please note the following details:
Status: Approved
Please get the book that you have been reserved at the mc library.

Should you have any further inquiries or require assistance, feel free to contact our support team at MC Salik-sik.

Thank you for using our services.

Sincerely,
MC Salik-sik Team
        `
      };

      // Send the email
      await transporter.sendMail(mailOptions);
      console.log('Approval email sent to:', user_email);
    }

    res.json({ success: true, message: 'Activity updated, logged, and formal email sent if approved' });
  } catch (error) {
    console.error('Error updating activity or sending email:', error);
    res.status(500).json({ success: false, message: 'Error updating activity or sending email' });
  }
});

app.delete("/api/bookactivities/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await client.query("DELETE FROM books_activity WHERE activity_id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).send("Book not found");
    }

    res.send("Book deleted");
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).send("Internal Server Error");
  }
});



//returned book
app.put('/api/returned_book/:id', async (req, res) => {
  const { id } = req.params;
  const { fine, book_state, delete_activity } = req.body; // Include delete_activity flag in the request body

  try {
    // Step 1: Update the reservation_status and book_state in the books_activity table
    await client.query(
      "  UPDATE books_activity SET action_type = 'Returned', status = 'Completed', fine = $1, book_state = CASE WHEN $2 = 'default' THEN book_state ELSE $2 END WHERE activity_id = $3",
      [fine, book_state, id]
    );

    // Step 2: Insert the updated activity into the book_history table
    const sql2 = `
      INSERT INTO book_history (book_id, user_email, action_type, action_date, fine, book_state, status)
      SELECT book_id, user_email, action_type, action_date, fine, book_state, status
      FROM books_activity
      WHERE activity_id = $1`;
    await client.query(sql2, [id]);

    // Step 3: Delete the activity from books_activity if delete_activity is true
    if (delete_activity) {
      await client.query("DELETE FROM books_activity WHERE activity_id = $1", [id]);
      res.json({ success: true, message: 'Activity updated, logged, and deleted successfully' });
    } else {
      res.json({ success: true, message: 'Activity updated and logged successfully' });
    }
  } catch (error) {
    console.error('Error updating, logging, or deleting activity:', error);
    res.status(500).json({ success: false, message: 'Error processing activity' });
  }
});


//increase book
app.put("/api/books_increase/:book_id", async (req, res) => {
  const bookId = req.params.book_id; // Get book_id from params

  try {
    // Increase the stock by 1
    const result = await client.query(
      "UPDATE book_list SET stocks = stocks + 1 WHERE book_id = $1 RETURNING stocks",
      [bookId]
    );

    // Check if the book was found and if the stock was updated
    if (result.rowCount === 0) {
      return res.status(404).send("Book not found or stock is already 0");
    }

    // Send back the updated stock value
    res.send({ message: "Book stock increased successfully", updatedStocks: result.rows[0].stocks });
  } catch (error) {
    console.error("Error increasing book stock:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Fetch all book activities
app.get('/api/booksToreturned', async (req, res) => {
  try {
    const result = await client.query("SELECT book_list.*, books_activity.* FROM books_activity INNER JOIN book_list ON books_activity.book_id = book_list.book_id WHERE action_type = 'Borrowed' AND status = 'Approved' OR status = 'Overdue'");
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});



//research api
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

app.get("/api/research", async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM research_repository");
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




//books logs api
app.get("/api/books_history", async (req, res) => {
  try {
    const result = await client.query("SELECT book_list.*, book_history.* FROM book_history INNER JOIN book_list ON book_history.book_id = book_list.book_id ORDER BY activity_id DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).send("Internal Server Error");
  }
});
app.delete("/api/books_history", async (req, res) => {
  try {
    // Delete all records from books_activity table
    const result = await client.query("DELETE FROM book_history");

    // If no rows are affected, send a message indicating no books were found
    if (result.rowCount === 0) {
      return res.status(404).send("No book activities found to delete");
    }

    res.send("All book activities deleted");
  } catch (error) {
    console.error("Error deleting all book activities:", error);
    res.status(500).send("Internal Server Error");
  }
});



//add digital copies
app.post("/api/digital_copies", async (req, res) => {
  const { title, author, year, url, stocks } = req.body;
  try {
    await client.query("INSERT INTO digital_lits (title, author, year, image_url, pdf_url) VALUES ($1, $2, $3, $4, $5)", [title, author, year, url, stocks]);
    res.status(201).send("Book added");
  } catch (error) {
    console.error("Error adding book:", error);
    res.status(500).send("Internal Server Error");
  }
});

//get digital copies
app.get("/api/digital_copies", async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM digital_lits ORDER BY title");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).send("Internal Server Error");
  }
});

//delete digital copies
app.delete("/api/digital_copies/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await client.query("DELETE FROM digital_lits WHERE book_id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).send("Book not found");
    }

    res.send("Book deleted");
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).send("Internal Server Error");
  }
});

//
app.post("/api/books", async (req, res) => {
  const { title, author, year, url, stocks } = req.body;
  try {
    await client.query("INSERT INTO book_list (title, author, year, url, stocks) VALUES ($1, $2, $3, $4, $5)", [title, author, year, url, stocks]);
    res.status(201).send("Book added");
  } catch (error) {
    console.error("Error adding book:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.put("/api/digital_copies/:book_id", async (req, res) => {
  const bookId = req.params.book_id; // Current book_id from params
  const { title, author, year, url, pdf_url } = req.body; // Include the necessary fields in the request body

  try {
    // Update the book in the books table (including URL)
    const result = await client.query(
      "UPDATE digital_lits SET title = $1, author = $2, year = $3, image_url = $4, pdf_url = $5 WHERE book_id = $6",
      [title, author, year, url, pdf_url, bookId] // Use bookId here
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


//
app.get("/api/books-reads", async (req, res) => {
  try {
    const result = await client.query("SELECT b.title, br.read_count, DATE_TRUNC('month', br.read_date) AS month FROM book_record br INNER JOIN book_list b ON br.book_id = b.book_id GROUP BY br.read_count, b.title, month ORDER BY month, b.title");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).send("Internal Server Error");
  }
});
//
app.get("/api/Research-graph", async (req, res) => {
  try {
    const result = await client.query(" SELECT year, COUNT(*) AS count FROM research_repository WHERE year IS NOT NULL GROUP BY year ORDER BY year ASC");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).send("Internal Server Error");
  }
});


//api for statistics of books
app.get("/api/books-read-over-month", async (req, res) => {
  try {
    const query = `
      SELECT 
        bl.title,
        SUM(br.read_count) AS total_reads
      FROM 
        public.book_record br
      JOIN 
        public.book_list bl ON br.book_id = bl.book_id
      WHERE 
        EXTRACT(YEAR FROM br.read_date) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND EXTRACT(MONTH FROM br.read_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      GROUP BY 
        bl.book_id, bl.title
      ORDER BY 
        total_reads DESC
      LIMIT 10;
    `;

    const result = await client.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/api/books-read-over-yearly", async (req, res) => {
  try {
    const query = `
SELECT 
  bl.book_id,
  bl.title,
  SUM(br.read_count) AS total_reads
FROM 
  public.book_record br
JOIN 
  public.book_list bl ON br.book_id = bl.book_id
WHERE 
  EXTRACT(YEAR FROM br.read_date) = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY 
  bl.book_id, bl.title
ORDER BY 
  total_reads DESC
LIMIT 10;
    `;

    const result = await client.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});




//check book if overdue
const updateOverdueBooks = async () => {
  const query = "UPDATE books_activity SET fine = (EXTRACT(day FROM current_timestamp - action_date) - 7) * 20, action_type = 'Overdue' WHERE EXTRACT(day FROM current_timestamp - action_date) > 7 AND action_type = 'Borrowed' AND status = 'Approved'";

  try {
    const res = await pool.query(query);
    console.log(`${res.rowCount} records updated to overdue status.`);
  } catch (err) {
    console.error('Error updating overdue books:', err);
  }
};

// Schedule the cron job to run every day at midnight
cron.schedule('19 0 * * *', () => {
  console.log('Running overdue books check...');
  updateOverdueBooks();
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
    <p><a href="https://fastupload.io/9f054b51a2992bf3" style="padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Download MC Salik-Sik</a></p>
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


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
