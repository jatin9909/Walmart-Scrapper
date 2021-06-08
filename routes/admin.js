const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

//requiring product model
let Product = require('../models/product');

// Checks if user is authenticated
function isAuthenticatedUser(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}
	req.flash('error_msg', 'Please Login first to access this page.');
	res.redirect('/login');
}

let browser;

//Scrape Function
async function scrapeData(url, page) {
	try {
		await page.goto(url, { waitUntil: 'load', timeout: 0 });
		const html = await page.evaluate(() => document.body.innerHTML);
		const $ = await cheerio.load(html);

		let title = $('h1').attr('content');
		let price = $('.price-characteristic').attr('content');

		if (!price) {
			let dollars = $(
				'#price > div > span.hide-content.display-inline-block-m > span > span.price-group.price-out-of-stock > span.price-characteristic'
			).text();
			let cents = $(
				'#price > div > span.hide-content.display-inline-block-m > span > span.price-group.price-out-of-stock > span.price-mantissa'
			).text();
			price = dollars + '.' + cents;
		}

		let seller = '';
		let checkSeller = $('.seller-name');
		if (checkSeller) {
			seller = checkSeller.text();
		}

		let outOfStock = '';
		let checkOutOfStock = $('.prod-ProductOffer-oosMsg');
		if (checkOutOfStock) {
			outOfStock = checkOutOfStock.text();
		}

		let deliveryNotAvaiable = '';
		let checkDeliveryNotAvailable = $('.fulfillment-shipping-text');
		if (checkDeliveryNotAvailable) {
			deliveryNotAvaiable = checkDeliveryNotAvailable.text();
		}

		let stock = '';

		if (
			!seller.includes('Walmart') ||
			outOfStock.includes('Out of Stock') ||
			deliveryNotAvaiable.includes('Delivery not available')
		) {
			stock = 'Out of stock';
		} else {
			stock = 'In stock';
		}

		return {
			title,
			price,
			stock,
			url
		};
	} catch (error) {
		console.log(error);
	}
}

router.get('/product/new', isAuthenticatedUser, async (req, res) => {
	try {
		let url = req.query.search;
		if (url) {
			browser = await puppeteer.launch({ args: [ '--no-sandbox' ] });
			const page = await browser.newPage();
			let result = await scrapeData(url, page);

			let productData = {
				title: result.title,
				price: '$' + result.price,
				stock: result.stock,
				productUrl: result.url
			};
			res.render('./admin/newproduct', { productData: productData });
			browser.close();
		} else {
			let productData = {
				title: '',
				price: '',
				stock: '',
				productUrl: ''
			};
			res.render('./admin/newproduct', { productData: productData });
		}
	} catch (error) {
		req.flash('error_msg', 'ERROR: ' + error);
		res.redirect('/product/new');
	}
});

module.exports = router;
