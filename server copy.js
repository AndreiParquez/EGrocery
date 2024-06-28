const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const session = require('express-session');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const upload = multer({ storage: multer.memoryStorage() });

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static('public'));
app.set('view engine', 'ejs');



// Increase the limit for URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Increase the limit for JSON bodies
app.use(bodyParser.json({ limit: '10mb' }));

// MySQL connection
const connection = mysql.createConnection({
    host: 'localhost',
    database: 'testing',
    user: 'root',
    password: ''
});

connection.connect((error) => {
    if (error) {
        console.error('Error connecting to MySQL database:', error);
        return;
    }
    console.log('MySQL connected');
});

// Session middleware
app.use(session({
    secret: '1234567890abcdefghijklmnopqrstuvwxyz',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));



// Route for Admin Dashboard
app.get('/admin', (req, res) => {
    const userId = req.session.userId;

    // Query to fetch monthly orders count
    const monthlyOrdersQuery = `
        SELECT 
            MONTH(transaction_date) AS month,
            COUNT(*) AS orderCount
        FROM 
            orders
        WHERE 
            user_id = ?
        GROUP BY 
            MONTH(transaction_date)
        ORDER BY 
            month
    `;

    connection.query(monthlyOrdersQuery, [userId], (error, results) => {
        if (error) {
            console.error('Error fetching monthly orders:', error);
            return res.status(500).send('Error fetching monthly orders');
        }

        // Organize the data by month for Chart.js
        const labels = [];
        const data = [];
        results.forEach(row => {
            const month = row.month;
            const orderCount = row.orderCount;

            // Convert month number to month name
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const monthName = monthNames[month - 1];

            const label = monthName;

            labels.push(label);
            data.push(orderCount);
        });

        // Fetch total count of products
        const productsCountQuery = 'SELECT COUNT(*) AS totalProducts FROM product';
        connection.query(productsCountQuery, (error, productResult) => {
            if (error) {
                console.error('Error fetching products count:', error);
                return res.status(500).send('Error fetching products count');
            }

            const totalProducts = productResult[0].totalProducts;

            // Fetch total count of users
            const usersCountQuery = 'SELECT COUNT(*) AS totalUsers FROM users';
            connection.query(usersCountQuery, (error, usersResult) => {
                if (error) {
                    console.error('Error fetching users count:', error);
                    return res.status(500).send('Error fetching users count');
                }

                const totalUsers = usersResult[0].totalUsers;

                // Fetch total count of orders
                const ordersCountQuery = 'SELECT COUNT(*) AS totalOrders FROM orders';
                connection.query(ordersCountQuery, (error, ordersResult) => {
                    if (error) {
                        console.error('Error fetching orders count:', error);
                        return res.status(500).send('Error fetching orders count');
                    }

                    const totalOrders = ordersResult[0].totalOrders;

                    // Calculate total sales
                    const totalSalesQuery = 'SELECT SUM(product_price * quantity) AS totalSales FROM orders';
                    connection.query(totalSalesQuery, (error, salesResult) => {
                        if (error) {
                            console.error('Error fetching total sales:', error);
                            return res.status(500).send('Error fetching total sales');
                        }



                        const totalSales = salesResult[0].totalSales || 0;
                        
                        const latestUsersQuery = `
                        SELECT id,user,address
                        FROM users
                        ORDER BY id DESC
                        LIMIT 3
                    `;
                
                    connection.query(latestUsersQuery, (error, users) => {
                        if (error) {
                            console.error('Error fetching latest users:', error);
                            return res.status(500).send('Error fetching latest users');
                        }
                        
                        
                        
                        
                        
                        
                        
                        // If there are no sales, default to 0

                        // Render admin.ejs template with total counts and monthly orders data
                        res.render('admin', { totalProducts, totalUsers, totalOrders, totalSales, labels, data,latestUsers: users });
                    });
                });
            });
        });
    });
});
});



// Route to serve the login form
app.get('/admin-product', (request, response) => {

     // Fetch products
     const productsQuery = 'SELECT * FROM product';
     connection.query(productsQuery, (error, products) => {
         if (error) {
             console.error('Error fetching products:', error);
             return response.status(500).send('Error fetching products');
         }
 
         if (!request.session.cart) {
             request.session.cart = [];
         }
 
         // Fetch orders for the logged-in user from the database
         const userId = request.session.userId;
         const getOrdersQuery = 'SELECT o.*, p.product_image FROM orders o JOIN product p ON o.product_id = p.product_id WHERE user_id = ?';
         connection.query(getOrdersQuery, [userId], (error, orders) => {
             if (error) {
                 console.error('Error fetching orders:', error);
                 return response.status(500).send('Error fetching orders');
             }
 
             orders.forEach(order => {
                 order.product_image = Buffer.from(order.product_image, 'binary').toString('base64');
             });
             // Convert image data to Base64 for each product
             products.forEach(product => {
                 product.product_image = Buffer.from(product.product_image, 'binary').toString('base64');
             });
             // Pass cart count to the home page template
             const cartCount = request.session.cart.length;
 
             // Render the product.ejs template with products, cart, and orders data
             response.render('admin-product', { products: products, cart: request.session.cart, orders: orders, cartCount: cartCount });
         });
     });

});








// Route to handle product edits
// Route to handle product edits
app.post("/edit-product", upload.single('product_image'), (request, response) => {
    const { product_id, product_name, product_price } = request.body;
    let updateProductQuery;
    let queryParams;

    if (request.file) {
        const product_image = request.file.buffer.toString('base64');
        updateProductQuery = `
            UPDATE product 
            SET product_name = ?, product_price = ?, product_image = ?
            WHERE product_id = ?
        `;
        queryParams = [product_name, product_price, product_image, product_id];
    } else {
        updateProductQuery = `
            UPDATE product 
            SET product_name = ?, product_price = ?
            WHERE product_id = ?
        `;
        queryParams = [product_name, product_price, product_id];
    }

    connection.query(updateProductQuery, queryParams, (error, results) => {
        if (error) {
            console.error('Error updating product:', error);
            return response.status(500).send('Error updating product');
        }

        // Redirect back to the cart page after updating the product
        response.redirect('/cart');
    });
});





// Route to serve the login form
app.get('/', (req, res) => {
    res.render('login');
});

// Route to handle login form submission
app.post('/login', (req, res) => {
    const user = req.body.user;
    const password = req.body.password;

    // Query database to check login credentials and retrieve user ID and name
    const query = 'SELECT * FROM users WHERE user = ? AND password = ?';
    connection.query(query, [user, password], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send('Error executing query');
        }

        if (results.length > 0) {
            // User found, login successful
            // Store user ID and user name in session
            req.session.userId = results[0].id;
            req.session.userName = results[0].user;
            res.redirect('/home');
        } else {
            // No user found, login failed
            res.send('Login failed. Please try again.');
        }
    });
});


// Route to load products and orders
app.get("/home", (request, response) => {
    // Fetch products
    const productsQuery = 'SELECT * FROM product';
    connection.query(productsQuery, (error, products) => {
        if (error) {
            console.error('Error fetching products:', error);
            return response.status(500).send('Error fetching products');
        }

        if (!request.session.cart) {
            request.session.cart = [];
        }

        // Fetch orders for the logged-in user from the database
        const userId = request.session.userId;
        const getOrdersQuery = 'SELECT o.*, p.product_image FROM orders o JOIN product p ON o.product_id = p.product_id WHERE user_id = ?';
        connection.query(getOrdersQuery, [userId], (error, orders) => {
            if (error) {
                console.error('Error fetching orders:', error);
                return response.status(500).send('Error fetching orders');
            }

            orders.forEach(order => {
                order.product_image = Buffer.from(order.product_image, 'binary').toString('base64');
            });
            // Convert image data to Base64 for each product
            products.forEach(product => {
                product.product_image = Buffer.from(product.product_image, 'binary').toString('base64');
            });
            // Pass cart count to the home page template
            const cartCount = request.session.cart.length;

            // Render the product.ejs template with products, cart, and orders data
            response.render('product', { products: products, cart: request.session.cart, orders: orders, cartCount: cartCount });
        });
    });
});



// Route to load products and orders
app.get("/cart", (request, response) => {
    // Fetch orders for the logged-in user from the database
    const userId = request.session.userId;
    const getOrdersQuery = `
        SELECT o.*, p.product_image 
        FROM orders o 
        JOIN product p ON o.product_id = p.product_id 
        WHERE o.user_id = ? 
        ORDER BY o.order_id DESC
    `;
    connection.query(getOrdersQuery, [userId], (error, orders) => {
        if (error) {
            console.error('Error fetching orders:', error);
            return response.status(500).send('Error fetching orders');
        }

        orders.forEach(order => {
            order.product_image = Buffer.from(order.product_image, 'binary').toString('base64');
        });

        // Render the cart.ejs template with products, cart, and orders data
        response.render('cart', { cart: request.session.cart, orders: orders, showSuccessModal: false });
    });
});






















// Route to add item into cart
app.post('/add_cart', (request, response) => {
    const product_id = request.body.product_id;
    const product_name = request.body.product_name;
    const product_price = request.body.product_price;
    const product_image = request.body.product_image;

    let count = 0;
    for (let i = 0; i < request.session.cart.length; i++) {
        if (request.session.cart[i].product_id === product_id) {
            request.session.cart[i].quantity += 1;
            count++;
        }
    }
    if (count === 0) {
        const cart_data = {
            product_image: product_image,
            product_id: product_id,
            product_name: product_name,
            product_price: parseFloat(product_price),
            quantity: 1
        };
        request.session.cart.push(cart_data);
    }
    response.redirect("/home");
});

// Route to remove item from cart
app.get('/remove_item', (request, response) => {
    const product_id = request.query.id;

    const index = request.session.cart.findIndex(item => item.product_id === product_id);

    if (index !== -1) {
        if (request.session.cart[index].quantity > 1) {
            // Decrease the quantity if it's greater than 1
            request.session.cart[index].quantity -= 1;
        } else {
            // Remove the item if the quantity is 1 or less
            request.session.cart.splice(index, 1);
        }
    }
    response.redirect("/home");
});

// Route to handle checkout process
app.post('/checkout', (request, response) => {
    const cartItems = request.session.cart;
    const userId = request.session.userId; // Assuming you have stored the user ID in the session after login

    // Check if there are items in the cart
    if (!cartItems || cartItems.length === 0) {
        return response.status(400).send('No items in the cart');
    }

    // Fetch user address from the database
    const getAddressQuery = 'SELECT address FROM users WHERE id = ?';
    connection.query(getAddressQuery, [userId], (error, results) => {
        if (error) {
            console.error('Error fetching user address:', error);
            return response.status(500).send('Error fetching user address');
        }

        if (results.length === 0) {
            return response.status(404).send('User not found');
        }

        const userAddress = results[0].address;

        // Generate unique transaction ID and transaction date
        const { transactionId, transactionDate } = generateTransactionInfo();

        // Default status for orders
        const defaultStatus = 'Order Placed';

        // Insert each item into the database
        const insertQueries = cartItems.map(item => {
            const { product_id, product_name, product_price, quantity } = item;
            const query = 'INSERT INTO orders (user_id, product_id, product_name, product_price, quantity, transaction_id, transaction_date, address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
            const values = [userId, product_id, product_name, product_price, quantity, transactionId, transactionDate, userAddress, defaultStatus];
            
            return new Promise((resolve, reject) => {
                connection.query(query, values, (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                });
            });
        });

        // Execute all insert queries
        Promise.all(insertQueries)
            .then(results => {
                // Clear the session cart
                request.session.cart = [];

                // Fetch orders for the logged-in user from the database
                const getOrdersQuery = 'SELECT o.*, p.product_image FROM orders o JOIN product p ON o.product_id = p.product_id WHERE user_id = ? ORDER BY o.order_id DESC';
                connection.query(getOrdersQuery, [userId], (error, orders) => {
                    if (error) {
                        console.error('Error fetching orders:', error);
                        return response.status(500).send('Error fetching orders');
                    }

                    orders.forEach(order => {
                        order.product_image = Buffer.from(order.product_image, 'binary').toString('base64');
                    });
                    response.render('cart', { cart: request.session.cart, orders: orders,showSuccessModal: true });

                });
            })
            .catch(error => {
                console.error('Error inserting items into database:', error);
                response.status(500).send('Error processing checkout');
            });
    });
});





// Function to generate a unique transaction ID and transaction date
function generateTransactionInfo() {
    const transactionId = Date.now().toString();
    const transactionDate = new Date().toISOString().slice(0, 19).replace('T', ' '); // Get current date and time in YYYY-MM-DD HH:MM:SS format

    return { transactionId, transactionDate };
}





// Route to fetch and display orders
app.get('/orders', (request, response) => {
    const userId = request.session.userId; // Assuming you have stored the user ID in the session after login

    // Fetch orders for the logged-in user from the database
    // Fetch orders for the logged-in user from the database
const getOrdersQuery = 'SELECT o.*, p.product_image FROM orders o JOIN product p ON o.product_id = p.product_id WHERE user_id = ?';
connection.query(getOrdersQuery, [userId], (error, results) => {
    if (error) {
        console.error('Error fetching orders:', error);
        return response.status(500).send('Error fetching orders');
    }
    
    // Convert image data to Base64 for each product
    results.forEach(order => {
        order.product_image = Buffer.from(order.product_image, 'binary').toString('base64');
    });

    // Render the EJS template with fetched orders
    response.render('orders', { orders: results });
});

});




// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
