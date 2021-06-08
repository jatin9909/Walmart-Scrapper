const express = require('express');
const router = express.Router();
const passport = require('passport');
const crypto = require('crypto');
const async = require('async');
const nodemailer = require('nodemailer');
//Requiring user model
const User = require('../models/usermodel');

//checks if user is authenticated
function isAuthenticateUser(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}
	req.flash('error_msg', 'Please Login first to access this page.');
	res.redirect('/login');
}

//Get routes
router.get('/login', (req, res) => {
	res.render('./users/login');
});

router.get('/signup', isAuthenticateUser, (req, res) => {
	res.render('./users/signup');
});

router.get('/dashboard', isAuthenticateUser, (req, res) => {
	res.render('./users/dashboard');
});

router.get('/logout', isAuthenticateUser, (req, res) => {
	req.logOut();
	req.flash('success_msg', 'You have been logged out.');
	res.redirect('/login');
});

router.get('/forgot', (req, res) => {
	res.render('./users/forgot');
});

router.get('/reset/:token', (req, res) => {
	User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } })
		.then((user) => {
			if (!user) {
				req.flash('error_msg', 'Password reset token in invalid or has expired');
				res.redirect('/forgot');
			}
			res.render('./users/newpassword', { token: req.params.token });
		})
		.catch((err) => {
			req.flash('error_msg', 'ERROR: ' + err);
			res.redirect('/forgot');
		});
});

router.get('/password/change', isAuthenticateUser, (req, res) => {
	res.render('./users/changepassword');
});

router.get('/users/all', isAuthenticateUser, (req, res) => {
	User.find({})
		.then((users) => {
			res.render('./users/alluser', { users: users });
		})
		.catch((err) => {
			console.log(err);
		});
});

router.get('/edit/:id', isAuthenticateUser, (req, res) => {
	let searchQuery = { _id: req.params.id };

	User.findOne(searchQuery)
		.then((user) => {
			res.render('./users/edituser', { user: user });
		})
		.catch((err) => {
			req.flash('error_msg', 'ERROR: ' + err);
			res.redirect('/users/all');
		});
});

//Post routes
router.post(
	'/login',
	passport.authenticate('local', {
		successRedirect: '/dashboard',
		failureRedirect: '/login',
		failureFlash: 'Invalid email or password. Try Again !!!'
	})
);

router.post('/signup', isAuthenticateUser, (req, res) => {
	let { name, email, password } = req.body;
	let userData = {
		name: name,
		email: email
	};

	User.register(userData, password, (err, user) => {
		if (err) {
			req.flash('error_msg', 'ERROR: ' + err);
			res.redirect('/signup');
		}
		req.flash('success_msg', 'Account created successfully');
		res.redirect('/signup');
	});
});

router.post('/password/change', (req, res) => {
	if (req.body.password !== req.body.confirmpassword) {
		req.flash('error_mg', "Password doesn't match");
		return res.redirect('/password/change');
	}

	User.findOne({ email: req.user.email }).then((user) => {
		user.setPassword(req.body.password, (err) => {
			user
				.save()
				.then((user) => {
					req.flash('success_msg', 'Password changed successfully');
					res.redirect('/password/change');
				})
				.catch((err) => {
					req.flash('error_msg', 'ERROR: ' + err);
					res.redirect('/password/change');
				});
		});
	});
});

//Routes to handle forgot password
router.post('/forgot', (req, res, next) => {
	let recoveryPassword = '';
	async.waterfall(
		[
			(done) => {
				crypto.randomBytes(30, (err, buf) => {
					let token = buf.toString('hex');
					done(err, token);
				});
			},
			(token, done) => {
				User.findOne({ email: req.body.email })
					.then((user) => {
						if (!user) {
							req.flash('error_msg', 'User does not exist with this email.');
							return res.redirect('/forgot');
						}

						user.resetPasswordToken = token;
						user.resetPasswordExpires = Date.now() + 1800000; // 1/2 hours

						user.save((err) => {
							done(err, token, user);
						});
					})
					.catch((err) => {
						req.flash('error_msg', 'ERROR: ' + err);
						res.redirect('/forgot');
					});
			},
			(token, user) => {
				let smtpTransport = nodemailer.createTransport({
					service: 'Gmail',
					auth: {
						user: process.env.GMAIL_EMAIL,
						pass: process.env.GMAIL_PASSWORD
					}
				});

				let mailOptions = {
					to: user.email,
					from: 'Jatin lillinanamuka@gmail.com',
					subject: 'Recovery Email from Auth Project',
					text:
						'Please click the following link to recover your password: \n\n' +
						'http://' +
						req.headers.host +
						'/reset/' +
						token +
						'\n\n' +
						'if you did not request this, please ignore this email.'
				};
				smtpTransport.sendMail(mailOptions, (err) => {
					req.flash('success_msg', 'Email send with firther instructions. Please check that.');
					res.redirect('/forgot');
				});
			}
		],
		(err) => {
			if (err) res.redirect('/forgot');
		}
	);
});

router.post('/reset/:token', (req, res) => {
	async.waterfall(
		[
			(done) => {
				User.findOne({
					resetPasswordToken: req.params.token,
					resetPasswordExpires: { $gt: Date.now() }
				})
					.then((user) => {
						if (!user) {
							req.flash('error_msg', 'Password reset token in invalid or has expired');
							res.redirect('/forgot');
						}

						if (req.body.password !== req.body.confirmpassword) {
							req.flash('error_msg', "Password doesn't match");
							res.redirect('/forgot');
						}

						user.setPassword(req.body.password, (err) => {
							user.resetPasswordToken = undefined;
							user.resetPasswordExpires = undefined;

							user.save((err) => {
								req.logIn(user, (err) => {
									done(err, user);
								});
							});
						});
					})
					.catch((err) => {
						req.flash('error_msg', 'ERROR: ' + err);
						res.redirect('/forgot');
					});
			},
			(user) => {
				let smtpTransport = nodemailer.createTransport({
					service: 'Gmail',
					auth: {
						user: process.env.GMAIL_EMAIL,
						pass: process.env.GMAIL_PASSWORD
					}
				});

				let mailOptions = {
					to: user.email,
					from: 'Jatin lillinanamuka@gmail.com',
					subject: 'Your password is changed',
					text:
						'Hello,' +
						user.name +
						'\n\n' +
						'This is the confirmation that the password for you account ' +
						user.email +
						' has been changed.'
				};

				smtpTransport.sendMail(mailOptions, (err) => {
					req.flash('Success_msg', 'Your password has been changed.');
					res.redirect('/login');
				});
			}
		],
		(err) => {
			res.redirect('/login');
		}
	);
});

//PUT routes starts here
router.put('/edit/:id', (req, res) => {
	let searchQuery = { _id: req.params.id };

	User.updateOne(searchQuery, {
		$set: {
			name: req.body.name,
			email: req.body.email
		}
	})
		.then((user) => {
			req.flash('success_msg', 'User updated sucessfully.');
			res.redirect('/users/all');
		})
		.catch((err) => {
			req.flash('error_msg', 'ERROR: ' + err);
			res.redirect('/users/all');
		});
});

//DELETE routes starts here
router.delete('/delete/user/:id', (req, res) => {
	let searchQuery = { _id: req.params.id };

	User.deleteOne(searchQuery)
		.then((user) => {
			req.flash('success_msg', 'User deleted sucessfully.');
			res.redirect('/users/all');
		})
		.catch((err) => {
			req.flash('error_msg', 'ERROR: ' + err);
			res.redirect('/users/all');
		});
});

module.exports = router;
