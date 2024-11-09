const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

console.log(process.env.DB)

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hrbkxoj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// middlewares
const logger = async(req, res, next) =>{
  console.log('called', req.host, req.originalUrl)
  next();
}

const verifyToken = async(req, res, next) =>{
  const token = req.cookies?.token;
  // console.log('Value of token in middleware', token)
  if(!token){
    return res.status(401).send({message: 'not authorized'})
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
    // error
    if(err){
      // console.log(err);
      return res.status(401).send({message: 'unauthosized access'})
    }
    // if token is valid then it would be decoded
    // console.log('value in the token', decoded)
    req.user = decoded;
    next();
  })
}
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const bookCollection = client.db('booklend').collection('books');
    const borrowingCollection = client.db('booklend').collection('borrowings');

    // auth related api
    app.post('/jwt', logger, async(req, res) =>{
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})

      res
      .cookie('token', token, {
        httpOnly: true,
        secure: false,
        // maxAge
        // sameSite: 'none'
      })
      .send({success: true})
    })

    // find all books - sevices related api
    app.get('/books', logger, async (req, res) => {
      const cursor = bookCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })

    // 
    app.get('/books/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }

      const options = {
        // Include only the `title` and `imdb` fields in the returned document
        projection: { name: 1, author: 1, category: 1, content: 1, image: 1, quantity: 1 },
      };

      const result = await bookCollection.findOne(query, options);
      res.send(result);
    })


    // borrowings
    app.get('/borrowings', logger, verifyToken, async(req, res) =>{
      // const borrowing = req.body;
      console.log(req.query.email);
      // console.log('Token found', req.cookies.token)
      console.log('User in the valid token', req.user)
      if(req.query.email !== req.user.email){
        return res.status(403).send({message: "forbidden access"})
      }
      let query = {};
      if(req.query?.email){
        query = { email: req.query.email }
      }
      const result = await borrowingCollection.find(query).toArray();
      res.send(result);
    })


    app.post('/borrowings', async(req, res) =>{
      const borrowing = req.body;
      console.log(borrowing);
      const result = await borrowingCollection.insertOne(borrowing);
      res.send(result);
    })

    app.patch('/borrowings/:id', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedBorrowing = req.body;
      console.log(updatedBorrowing);
      const updatedDoc = {
        $set: {
          status: updatedBorrowing.status
        },
      };
      const result = await borrowingCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.delete('/borrowings/:id', async(req, res) =>{
      const id = req.params.id;
      const query= {_id: new ObjectId(id)}
      const result = await borrowingCollection.deleteOne(query);
      res.send(result);
    })

    app.patch('/users/admin/:id', async(req, res) =>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await borrowingCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Boklend is lending')
})

app.listen(port, () => {
  console.log(`Booklend server is running on port ${port}`)
})