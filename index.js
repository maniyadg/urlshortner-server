const express = require("express");
const cors = require("cors");
const mongodb = require("mongodb");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");
const app = express();
const dotenv = require("dotenv").config();
const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const JWT_SECRET = process.env.JWT_SECRET;

const url = process.env.DB;
const client = new MongoClient(url);

app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/user/register", async (req, res) => {
  // db connection
  try {
    const connection = await client.connect();
    const db = connection.db("urlShortner");
    // hasing - password secure
    var salt = await bcrypt.genSalt(10);
    var hash = await bcrypt.hash(req.body.password, salt);
    req.body.password = hash;
    const product = await db.collection("urls").insertOne(req.body);
    await connection.close();
    res.json({ message: "user created", id: product.insertedId });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "something went wrong" });
  }
});

// login method
app.post("/user/login", async (req, res) => {
  // db connection
  try {
    const connection = await client.connect();
    const db = connection.db("urlShortner");
    const user = await db.collection("urls").findOne({ email: req.body.email });
    if (user) {
      const compare = await bcrypt.compare(req.body.password, user.password);
      if (compare) {
        const token = jwt.sign({ _id: user._id }, JWT_SECRET, {
          expiresIn: "2m",
        });
        res.json({ message: "success", token });
      } else {
        res.json({ message: "incorrect userName/password " });
      }
    } else {
      res.status(404).json({ message: "incorrect userName/password " });
    }

    // await connection.close();
  } catch (error) {}
});

app.post("/forget", async (req, res) => {
  try {
    const connection = await client.connect();
    const db = connection.db("urlShortner");
    const user = await db
      .collection("urls")
      .findOne({ email: req.body.email });
    if (!user) {
      res.json({ message: "User doesn't exist" });
    }
    const secret = user.password + JWT_SECRET;
    const token = jwt.sign({ _id: user._id, email: user.email }, secret, {
      expiresIn: "5m",
    });
    console.log(token);
    const link = `http://localhost:3001/reset-password/${user._id}/${token}`;
    console.log(link);

    let transporter = nodemailer.createTransport({
      service: "gmail",
      secure: false,
      auth: {
        user: process.env.USER,
        pass: process.env.PASSWORD,
      },
    });
    // send mail with defined transport object
    let details = {
      from: process.env.USER, // sender address
      to: req.body.email, // list of receivers
      subject: "Reset-Password", // Subject line
      text: link,
    };

    transporter.sendMail(details, (err) => {
      if (err) {
        console.log("error", err);
      } else {
        console.log("email sent");
      }
    });
    res.json(link);
  } catch (error) {}
});

app.put("/reset-password/:id/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  try {
    const connection = await client.connect();
    const db = connection.db("urlShortner");
    const userdata = await db
      .collection("urls")
      .findOne({ _id: mongodb.ObjectId(req.params.id) });
    if (!userdata) {
      res.json({ message: "User doesn't exist" });
    }
    const secret = userdata.password + JWT_SECRET;
    const verify = jwt.verify(token, secret);
    const confirnPassword = await bcrypt.hash(password, 10);
    const user = await db.collection("urls").updateOne(
      {
        _id: mongodb.ObjectId(req.params.id),
      },
      {
        $set: {
          password: confirnPassword,
        },
      }
    );
    await connection.close();
    res.send({ email: verify.email, status: "verified", user });
  } catch (error) {
    res.json({ status: "Something Went Wrong" });
  }
});

app.post("/urlshortner", async (req, res) => {
  // db connection
  try {
    const connection = await client.connect();
    const db = connection.db("urlShortner");
    const urlshort = {
      fullurl: req.body,
      shorturl: generateUrl(),
    };
    const longurl = await db.collection("urls").insertOne(urlshort);
    await connection.close();
    res.json({ message: "product created", id: longurl.insertedId, shorturl });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "something went wrong" });
  }
});

app.get("/:urlid", async (req, res) => {
  try {
    const connection = await client.connect();
    const db = connection.db("urlShortner");
    const shorturl = req.params.urlid;
    const fulldata = await db.collection("urls").findOne({ shorturl });
    if (fulldata) {
      let longurl = fulldata.fullurl.longurl;
      console.log(fulldata);
      console.log(longurl);
      await db
      .collection("urls")
      .findOneAndUpdate({ shorturl }, { $inc: { count: 1 } });
    res.redirect(longurl);
    }


    await connection.close();
    res.json(shorturl);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "something went wrong" });
  }
});

function generateUrl() {
  var rndResult = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;

  for (var i = 0; i < 5; i++) {
    rndResult += characters.charAt(
      Math.floor(Math.random() * charactersLength)
    );
  }
  console.log(rndResult);
  return rndResult;
}

app.listen(process.env.PORT || 3003, function () {
  console.log("Server Listening!");
});
