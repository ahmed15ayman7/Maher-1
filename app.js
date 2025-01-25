const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { prisma } = require("./prisma.js");
const path = require("path");
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const app = express();
const dataFilePath = path.join(__dirname, "cars.json");
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));const readJSONFile = () => {
  try {
    const data = fs.readFileSync(dataFilePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading JSON file:", error);
    return [];
  }
};
const writeJSONFile = (data) => {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing JSON file:", error);
  }
};
app.get("/getCars", (req, res) => {
  const jsonData = readJSONFile();
  res.status(201).json({ message: "success", data: jsonData });
});
app.get("/getCars/:id", (req, res) => {
  const { id } = req.params;
  const jsonData = readJSONFile();

  let foundCar = null;

  // Search for the car across all brands
  for (const brand in jsonData) {
    foundCar = jsonData[brand]["models"].find((car) => car.id === parseInt(id, 10));
    if (foundCar) 
      carBrand = brand;
      break; // Stop searching once the car is found
  }

  if (foundCar) {
    res.status(201).json({ message: "success",brand: carBrand, data: foundCar });
  } else {
    res.status(404).json({ message: "Car not found" });
  }
});
app.get("/carBM", (req, res) => {
  const { brand, model } = req.query;  // Get brand and model from query parameters
  const jsonData = readJSONFile();

  let foundCar = null;

  // Search for the car in the specified brand and model
  if (brand && model && jsonData[brand]) {
    foundCar = jsonData[brand]["models"].find((car) => car.Model.toLowerCase() === model.toLowerCase());
  }

  // Return the found car or an error message
  if (foundCar) {
    res.status(201).json({ message: "success", brand: brand, data: foundCar });
  } else {
    res.status(404).json({ message: "Car not found" });
  }
});
app.get("/show", async (req, res) => {
  try {
    // Fetch all users from the database
    const users = await prisma.user.findMany();

    // Check if users array is empty
    if (users.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }

    // Return success response with users
    res.status(201).json({ message: "success", users });
  } catch (error) {
    // Log and return error response
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users", error });
  }
});
app.post("/registerApi", async (req, res) => {
  const { name, email, phone} = req.body;
  
  // Generate a random 4-digit numeric verification code
  const verificationCode = Math.floor(1000 + Math.random() * 9000); // This will generate a 4-digit number

  try {
    // Step 1: Create the user in the database
   let user= await prisma.user.create({
      data: { name, email, phone, verificationCode:`${verificationCode}`},
    });

    // Step 2: Set up Nodemailer transporter using environment variables
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASSWORD,
      },
    });

    // Step 3: Compose the email with styling
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Registration Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f9; padding: 20px; text-align: center; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #007bff;">Welcome to Maher for Cars Services</h2>
            <p style="font-size: 16px; color: #555;">Thank you for registering. To complete your registration, please use the verification code below:</p>
            <h3 style="font-size: 24px; color: #333; background-color: #f8f9fa; padding: 10px 20px; border-radius: 6px; display: inline-block;">${verificationCode}</h3>
            <p style="font-size: 16px; color: #555; margin-top: 20px;">If you didn't request this, please ignore this email.</p>
            <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;">
            <p style="font-size: 14px; color: #777;">Kind Regards,<br>MAHER Team</p>
          </div>
        </div>
      `,
    };

    // Step 4: Send the email
    await transporter.sendMail(mailOptions);

    // Step 5: Respond with success message
    res.status(201).json({ message: "success",user:{ verificationCode:`${verificationCode}`,phone,id:user.id} });

  } catch (error) {
    if (error.code === 'EAUTH') {
      res.status(500).json({ message: "SMTP authentication failed", error });
    } else if (error.message.includes("unique constraint")) {
      res.status(400).json({ message: "User with this email already exists", error });
    } else {
      res.status(500).json({ message: "Error adding registration", error });
    }
    console.error(error);
  }
});
app.post("/login", async (req, res) => {
  const { phone } = req.body;

  // Generate a random 4-digit verification code
  const verificationCode = Math.floor(1000 + Math.random() * 9000);

  try {
    // Step 1: Find the user by phone number
    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (user) {
      // Step 2: Update the user's verification code in the database
      await prisma.user.update({
        where: { phone },
        data: { verificationCode: `${verificationCode}` },
      });

      // Step 3: Set up Nodemailer transporter
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASSWORD,
        },
      });

      // Step 4: Compose the email with the verification code
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: user.email, // Send email to the user's registered email
        subject: 'Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #f4f4f9; padding: 20px; text-align: center; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #007bff;">Verification Code</h2>
              <p style="font-size: 16px; color: #555;">Hello ${user.name},</p>
              <p style="font-size: 16px; color: #555;">Your verification code is:</p>
              <h3 style="font-size: 24px; color: #333; background-color: #f8f9fa; padding: 10px 20px; border-radius: 6px; display: inline-block;">${verificationCode}</h3>
              <p style="font-size: 16px; color: #555; margin-top: 20px;">Please use this code to verify your login. If you didn't request this, please contact our support team immediately.</p>
              <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;">
              <p style="font-size: 14px; color: #777;">Kind Regards,<br>MAHER Team</p>
            </div>
          </div>
        `,
      };

      // Step 5: Send the email
      await transporter.sendMail(mailOptions);
      // Step 6: Respond with success
      res.status(201).json({
        message: "Verification code sent successfully",
        user: {
          ...user,
          verificationCode: verificationCode.toString() // Convert to string
        }
      });
          } else {
      // Step 7: Handle case where user is not found
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    // Step 8: Handle errors
    res.status(500).json({ message: "Error during login", error });
    console.error(error);
  }
});
app.post('/addCar', async (req, res) => {
  const {
    userId,
    image,
    brand,
    model,
    color,
    fuelType,
    discNumber,
    licensePlate,
    madeYear,
    kilometers,
    estmara,
  } = req.body;

  try {
    // Validate required fields
    if (!userId || !brand || !model || !color || !fuelType || !licensePlate || !madeYear || !kilometers || !image) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Check if the user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Create a new car and associate it with the user
    const newCar = await prisma.car.create({
      data: {
        brand,
        model,
        image,
        color,
        fuelType,
        discNumber,
        licensePlate,
        madeYear,
        kilometers,
        estmara,
        userId,
      },
    });

    // Respond with the newly created car
    res.status(201).json({
      message: 'Car added successfully.',
      car: newCar,
    });
  } catch (error) {
    console.error('Error adding car:', error);
    res.status(500).json({ message: 'Error adding car.', error: error.message });
  }
});
app.post("/fix", async (req, res) => {
  const { name, kilometers, lastFixDate, fix, rememberMe, morfaqat, carId } = req.body;

  try {
    // Basic validation for required fields
    if (!name || !kilometers || !lastFixDate || !fix  || !carId) {
      return res
        .status(400)
        .json({ message: "All fields except 'rememberMe' are required" });
    }

    // Check if the car exists
    const car = await prisma.car.findUnique({
      where: { id: carId },
    });

    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    // Save fix data to the database
    const fixEntry = await prisma.fix.create({
      data: {
        name, // Include the name field
        kilometers,
        lastFixDate: new Date(lastFixDate),
        fix,
        rememberMe: rememberMe ? new Date(rememberMe) : null, // Optional field
        morfaqat,
        carId, // Associate the fix with the car
      },
    });

    // Respond with success
    res.status(200).json({ message: "Fix entry saved successfully", fixEntry });
  } catch (error) {
    // Handle database and other errors
    console.error("Error saving fix entry:", error);

    // Customize error response based on the error type
    if (error.code === "P2002") {
      res.status(400).json({ message: "Duplicate entry detected", error });
    } else {
      res.status(500).json({ message: "Error saving fix entry", error });
    }
  }
});
app.delete('/deleteCar/:id', async (req, res) => {
  const { id } = req.params;

  // Basic Validation: Check if the id is provided and is a number
 
  try {
    // Check if the car exists before trying to delete
    const car = await prisma.car.findUnique({
      where: { id: id },
    });

    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    // Delete the car
    await prisma.car.delete({
      where: { id: id },
    });

    // Respond with success
    res.status(201).json({ message: 'Car deleted successfully' });

  } catch (error) {
    console.error('Error deleting car:', error);
    res.status(500).json({ message: 'Error deleting car', error: error.message });
  }
});
app.delete('/deleteUser/:id', async (req, res) => {
  const { id } = req.params;

  // Validate that the id is provided
  if (!id) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    // Check if the user exists
    const user = await prisma.user.findUnique({
      where: { id: id },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete the user
    await prisma.user.delete({
      where: { id: id },
    });

    // Respond with success
    res.status(200).json({ message: 'User deleted successfully' });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
});
app.get('/getCar/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch car by ID
    const car = await prisma.car.findUnique({
      where: { id },
    });

    // If the car is not found
    if (!car) {
      return res.status(404).json({ message: 'Car not found' });
    }

    // Respond with the car data
    res.status(201).json({ message: 'Car retrieved successfully', car });
  } catch (error) {
    console.error('Error fetching car by ID:', error);

    // Handle invalid ObjectId format
    if (error.code === 'P2025') {
      res.status(404).json({ message: 'Car not found' });
    } else {
      res.status(500).json({ message: 'Error retrieving car data', error: error.message });
    }
  }
});
app.get("/user/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch the user by ID, including their cars and the full fix details for each car
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        cars: {
          include: {
            fixes: {
              select: {
                id: true,            // Fix ID
                kilometers: true,    // Kilometers
                lastFixDate: true,   // Last fix date
                fix: true,           // Fix name
                rememberMe: true,    // Remember me
                morfaqat: true,      // Morfaqat
                createdAt: true,     // Created At
              },
            },
          },
        },
      },
    });

    // Check if user exists
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prepare response with user data, including cars and their full fix data
    const userData = {
      ...user,
      cars: user.cars.map((car) => ({
        ...car,
        fixes: car.fixes.map((fix) => ({
          id: fix.id,
          kilometers: fix.kilometers,
          lastFixDate: fix.lastFixDate,
          fixName: fix.fix,
          rememberMe: fix.rememberMe,
          morfaqat: fix.morfaqat,
          createdAt: fix.createdAt,
        })),
      })),
    };

    res.status(201).json(userData);
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ message: "Error fetching user data", error: error.message });
  }
});
app.post("/address", async (req, res) => {
  const { userId, address, type } = req.body;

  // Validate input
  if (!userId || !address || !type) {
    return res.status(400).json({ error: "User ID, Address, and Type are required." });
  }

  try {
    // Save the address in the database and associate it with the user
    const newAddress = await prisma.address.create({
      data: {
        address,
        type,
        user: { connect: { id: userId } }, // Relate the address to the user via userId
      },
    });

    res.status(201).json({
      message: "Address saved successfully!",
      data: newAddress,
    });
  } catch (error) {
    console.error("Error saving address:", error);
    res.status(500).json({ error: "Failed to save address." });
  }
});
app.get('/getCarsByUser/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Fetch cars associated with the userId
    const cars = await prisma.car.findMany({
      where: { userId },
    });

    // If no cars are found for the user
    if (cars.length === 0) {
      return res.status(404).json({ message: 'No cars found for the specified user' });
    }

    // Respond with the cars data
    res.status(201).json({ message: 'Cars retrieved successfully', cars });
  } catch (error) {
    console.error('Error fetching cars by user ID:', error);

    // Handle errors
    res.status(500).json({ message: 'Error retrieving cars data', error: error.message });
  }
});
app.get("/getFix", async (req, res) => {
  const { carId, name } = req.query;

  try {
    // Validate input
    if (!carId && !name) {
      return res.status(400).json({ message: "Please provide carId or name." });
    }

    // Fetch fixes based on carId or name
    const fixes = await prisma.fix.findMany({
      where: {
        carId,
          name  // If name exists, use it in the query
      },
    });

    // Check if fixes were found
    if (fixes.length === 0) {
      return res.status(404).json({ message: "No fixes found for the given criteria." });
    }

    // Respond with the fixes
    res.status(201).json({ message: "Fixes retrieved successfully", fixes });
  } catch (error) {
    console.error("Error fetching fixes:", error);
    res.status(500).json({ message: "Error fetching fixes", error: error.message });
  }
});
app.get("/getFixById/:fixId", async (req, res) => {
  const { fixId } = req.params; // Extract the fixId from the route parameter

  try {
    // Validate input
    if (!fixId) {
      return res.status(400).json({ message: "Please provide a fixId." });
    }

    // Fetch the fix by fixId
    const fix = await prisma.fix.findUnique({
      where: {
        id: fixId, // Ensure this matches your database schema
      },
    });

    // Check if the fix was found
    if (!fix) {
      return res.status(404).json({ message: "Fix not found for the given ID." });
    }

    // Respond with the fix
    res.status(201).json({ message: "Fix retrieved successfully", fix });
  } catch (error) {
    console.error("Error fetching fix by ID:", error);
    res.status(500).json({ message: "Error fetching fix by ID", error: error.message });
  }
});
app.get("/show-cars", async (req, res) => {
  try {
    // Fetch all cars along with the associated user's name
    const cars = await prisma.car.findMany({
      include: {
        user: {
          select: {
            name: true, // Only select the user's name
          },
        },
      },
    });

    // Check if cars array is empty
    if (cars.length === 0) {
      return res.status(404).json({ message: "No cars found" });
    }

    // Map the cars array to include user name information
    const carsWithUser = cars.map(car => ({
      id: car.id,
      image: car.image,
      brand: car.brand,
      model: car.model,
      color: car.color,
      fuelType: car.fuelType,
      discNumber: car.discNumber,
      licensePlate: car.licensePlate,
      madeYear: car.madeYear,
      kilometers: car.kilometers,
      estmara: car.estmara,
      userName: car.user.name, // Add the user's name to the car object
    }));

    // Return success response with cars and their user's name
    res.status(201).json({ message: "success", cars: carsWithUser });
  } catch (error) {
    // Log and return error response
    console.error("Error fetching cars:", error);
    res.status(500).json({ message: "Error fetching cars", error });
  }
});
app.put("/updateUser/:id", async (req, res) => {
  const { id } = req.params; // Extract user ID from URL parameters
  const { name, email, phone } = req.body; // Extract fields to update from the request body

  try {
    // Validate if the user exists
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update the user data
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(name && { name }), // Only update if `name` is provided
        ...(email && { email }), // Only update if `email` is provided
        ...(phone && { phone }), // Only update if `phone` is provided
      },
    });

    // Respond with the updated user data
    res.status(200).json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);

    if (error.message.includes("unique constraint")) {
      res.status(400).json({ message: "Email or phone already exists", error });
    } else {
      res.status(500).json({ message: "Error updating user", error });
    }
  }
});
const PORT = 3999;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
