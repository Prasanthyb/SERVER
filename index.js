
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require("cors");

const Product = require("./models/product");
const User = require("./models/user")





const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));



const PORT = process.env.PORT || 3000;

mongoose.set('strictQuery', false);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

// GET ALL PRODUCTS FROM products COLLECTION
app.get('/products', async (req, res) => {
  try {
    let query;
    let uiValues = {
      filtering: {},
      sorting: {},
    };

    // Parsing and Filtering Request Query Parameters
    const reqQuery = { ...req.query };
    const removeFields = ["sort", "page", "limit"];
    removeFields.forEach((val) => delete reqQuery[val]);

    const filterKeys = Object.keys(reqQuery);
    const filterValues = Object.values(reqQuery);

    filterKeys.forEach((val, idx) => (uiValues.filtering[val] = filterValues[idx]));

    // Building MongoDB Query
    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, (match) => `$${match}`);
    query = Product.find(JSON.parse(queryStr));

    // Sorting Results
    if (req.query.sort) {
      const sortByArr = req.query.sort.split(",");
      sortByArr.forEach((val) => {
        const order = val[0] === "-" ? "descending" : "ascending";
        uiValues.sorting[val.replace("-", "")] = order;
      });
      const sortByStr = sortByArr.join(" ");
      query = query.sort(sortByStr);
    } else {
      query = query.sort("-price");
    }

    // Selecting Specific Fields
    const select = req.query.select;
    if (select) {
      const selectFix = select.split(",").join(" ");
      query = query.select(selectFix);
    }

    // Pagination
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 8;
    const skip = (page - 1) * limit;
    query = query.skip(skip).limit(limit);

    // Query Execution and Response
    const Products = await query.exec();
    const totalCount = await Product.countDocuments();
    const totalPages = Math.ceil(totalCount / limit);

    const maxPrice = await Product.find()
      .sort({ price: -1 })
      .limit(1)
      .select("-_id price");

    const minPrice = await Product.find()
      .sort({ price: 1 })
      .limit(1)
      .select("-_id price");

    uiValues.maxPrice = maxPrice[0] ? maxPrice[0].price : 0;
    uiValues.minPrice = minPrice[0] ? minPrice[0].price : 0;

    res.status(200).json({
      success: true,
      data: Products,
      uiValues,
      pagination: {
        totalPages,
        currentPage: page,
        totalHits: totalCount,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// CREATE
app.post('/products', async (req, res) => {
  try {
    const product = await Product.create(req.body);

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// UPDATE
app.put('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: `Product with id ${req.params.id} was not found`,
      });
    }

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// DELETE
app.delete('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndRemove(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: `Product with id ${req.params.id} was not found`,
      });
    }

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

//  LOGIN

app.post('/users/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const check = await User.findOne({ email: email });

    if (check) {
      res.json("exist");
    } else {
      res.json("notexist");
    }
  } catch (e) {
    res.json("fail");
  }
});

// SIGNUP            

app.post('/users/signup', async (req, res) => {
  const { name, email, password } = req.body;

  const data = {
    name: name,
    email: email,
    password: password
  };

  try {
    const check = await User.findOne({ email: email });

    if (check) {
      res.json("exist");
    } else {
      res.json("notexist");
      await User.insertMany([data]);
    }
  } catch (e) {
    res.json("fail");
  }
});



// Connect to MongoDB and start the server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log("Listening for requests on port:", PORT);
  });
});
