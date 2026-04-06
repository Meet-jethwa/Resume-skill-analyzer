import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import analyzeRoute from './routes/analyze.js';
import historyRoute from './routes/history.js';
dotenv.config();

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://resume-skill-analyzer-1ydt.vercel.app'
  ]
}));

app.use(express.json());

// Configure multer for PDF uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Make upload available to routes
app.use((req, res, next) => {
  req.upload = upload;
  next();
});

app.get('/', (req, res) => res.send('Resume Analyzer API running'));
app.use('/api/analyze', upload.single('pdf'), analyzeRoute);
app.use('/api/history', historyRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
