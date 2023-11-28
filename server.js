const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const passport = require('passport');
const expressSession = require('express-session');
const LocalStrategy = require('passport-local').Strategy;
require('dotenv').config();
const upload = require('./upload');
const cloudinary = require('cloudinary').v2;


app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressSession({ secret: 'pdtdi', resave: false, saveUninitialized: false }));
app.set('view engine', 'ejs');

cloudinary.config({
  cloud_name: 'dwekaokif',
  api_key: '753514526794589',
  api_secret: 'G7YXvVExjtrqhMZWcUSgDHaG0yw'
});


const PORT = process.env.PORT || 3500;

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    req.session.username = req.user.username
    return next();
  } else {
    res.redirect('/login');
  }
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('Sikeres csatlakozás!'))
  .catch((error) => console.log('Valami hiba történt!' + error.message));

mongoose.connection.on('open', () => console.log('Sikeres megnyitás!'));
mongoose.connection.on('close', () => console.log('Sikeres zárás!'));



const User = mongoose.model('User', {
  username: String,
  password: String,
  profileImage: String,
});


app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
  function(username, password, done) {
    User.findOne({ username: username, password: password })
      .then(user => {
        if (!user) {
          return done(null, false, { message: 'Hibás felhasználónév vagy jelszó' });
        }
        return done(null, user);
      })
      .catch(err => {
        return done(err);
      });
  }
));


passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id)
    .then(user => {
      done(null, user);
    })
    .catch(err => {
      done(err);
    });
});


app.get('/', (req, res) => {
  res.render('index');
});

app.get('/about', (req, res) => {
  res.render('about');
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const user = new User({ username, password });

  user.save()
    .then(() => {
      res.redirect('/login');
    })
    .catch((err) => {
      res.send('Hiba a regisztráció során: ' + err);
    });
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/profile',
  failureRedirect: '/login',
  failureFlash: true
}));

app.get('/profile', isLoggedIn, (req, res) => {
  const username = req.session.username;
  const profileImage = req.user.profileImage || 'https://res.cloudinary.com/dwekaokif/image/upload/v1700122763/free-clipart-without-copyright_pzrzhw.jpg';
 // A felhasználó neve
  res.render('profile', {username, profileImage});
});

let results = [];

app.get('/calculate', (req, res) => {
  res.render('calc', { results });
})
app.post('/calculate', (req, res) => {

  results = [];
  const weight = parseFloat(req.body.weight);
  const height = parseFloat(req.body.height);
  const age = parseInt(req.body.age);
  const gender = req.body.gender;
  const activityLevel = parseFloat(req.body.activityLevel);

  if (!isNaN(weight) && !isNaN(height) && !isNaN(age) && !isNaN(activityLevel) && gender && activityLevel) {
    const bmr = calculateBMR(weight, height, age, gender);
    const totalCalories = calculateTotalCalories(bmr, activityLevel);

    const result = {
      weight,
      height,
      age,
      gender,
      activityLevel,
      bmr,
      totalCalories,
      date: new Date().toLocaleString()
    };

    results.push(result); // Az ideiglenes eredményeket frissítjük

    res.render('calc', { results }); // Visszaküldjük az eredményeket a sablonnak
  } else {
    res.render('calc', { results, error: 'Hibás adatok. Kérem, töltsön ki minden mezőt.' });
  }
});

function calculateBMR(weight, height, age, gender) {
  if (gender.toLowerCase() === 'male') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else if (gender.toLowerCase() === 'female') {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  } else {
    return 0;
  }
}

function calculateTotalCalories(bmr, activityLevel) {
  return bmr * activityLevel;
}

app.post('/upload', isLoggedIn, upload.single('profileImage'), async (req, res) => {
  try {
    // Felhasználó azonosítója
    const userId = req.user.id;

    // Az elérési út vagy az egyedi azonosító hozzáadása az adatbázishoz
    const imagePath = 'public/uploads/profiles/' + req.file.filename;

    // Feltöltjük a fájlt a Cloudinary-re
    const result = await cloudinary.uploader.upload(req.file.path, { folder: 'profiles' });

    // Az url lesz a Cloudinary-n tárolt kép elérési útja
    const profileImage = result.secure_url;

    // Felhasználó frissítése az új profilképpel
    const updatedUser = await User.findByIdAndUpdate(userId, { profileImage });

    if (!updatedUser) {
      // Felhasználó nem található
      return res.status(404).send('User not found');
    }

    res.redirect('/profile');
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});



app.get('/upload', isLoggedIn, (req, res) => {
  res.render('upload');
});


app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/login');
  });
});


app.listen(PORT, () => {
  console.log(`Server a http://localhost:${PORT}`);
});