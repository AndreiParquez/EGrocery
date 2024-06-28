const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');


const app = express();
const upload = multer({ dest: 'public/uploads/' });
const saltRounds = 10;

// Middleware
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static('public'));
app.set('view engine', 'ejs');







// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/profile_images'); // Destination folder for profile images
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); // Unique filename
    }
});

// File filter function
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true); // Accept image files
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const uploadprof = multer({ storage: storage, fileFilter: fileFilter });
const connection = mysql.createConnection({
    host: 'localhost',
    database: 'test',
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

// Route to serve the login form
app.get('/', (req, res) => {
    res.render('login');
});
app.get('/signup', (req, res) => {
    res.render('signup');
});
app.post('/login', (req, res) => {
    const user = req.body.user;
    const password = req.body.password;

    // Query database to retrieve hashed password for the provided username
    const query = 'SELECT id, user, password FROM users WHERE user = ?';
    connection.query(query, [user], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send('Error executing query');
        }

        if (results.length > 0) {
            const hashedPassword = results[0].password;

            // Compare the provided password with the hashed password
            bcrypt.compare(password, hashedPassword, (compareErr, isMatch) => {
                if (compareErr) {
                    console.error('Error comparing passwords:', compareErr);
                    return res.status(500).send('Error comparing passwords');
                }

                if (isMatch) {
                    // Passwords match, login successful
                    // Store user ID and user name in session
                    req.session.userId = results[0].id;
                    req.session.userName = results[0].user;
                    res.redirect('/home');
                } else {
                    // Passwords don't match, login failed
                    res.send('Login failed. Please try again.');
                }
            });
        } else {
            // No user found with the provided username
            res.send('Login failed. Please try again.');
        }
    });
});

// Route to load products and orders
app.get("/home", (request, response) => {
    const productsQuery = `
        SELECT p.*, c.name AS category_name
        FROM product p
        JOIN categories c ON p.category_id = c.id
        WHERE p.deleted = false
    `;
    connection.query(productsQuery, (error, products) => {
        if (error) {
            console.error('Error fetching products:', error);
            return response.status(500).send('Error fetching products');
        }

        if (!request.session.cart) {
            request.session.cart = [];
        }

        const userId = request.session.userId;
        const getOrdersQuery = 'SELECT o.*, p.product_image FROM orders o JOIN product p ON o.product_id = p.product_id WHERE user_id = ?';
        connection.query(getOrdersQuery, [userId], (error, orders) => {
            if (error) {
                console.error('Error fetching orders:', error);
                return response.status(500).send('Error fetching orders');
            }

            // Group products by category
            const groupedProducts = products.reduce((acc, product) => {
                const categoryName = product.category_name;
                if (!acc[categoryName]) {
                    acc[categoryName] = [];
                }
                acc[categoryName].push(product);
                return acc;
            }, {});

            // Render the product.ejs template with grouped products, cart, and orders data
            response.render('product', { 
                groupedProducts: groupedProducts, 
                cart: request.session.cart, 
                orders: orders, 
                cartCount: request.session.cart.length 
            });
        });
    });
});


// Route to load products and orders
app.get("/contact", (request, response) => {
    const productsQuery = `
        SELECT p.*, c.name AS category_name
        FROM product p
        JOIN categories c ON p.category_id = c.id
        WHERE p.deleted = false
    `;
    connection.query(productsQuery, (error, products) => {
        if (error) {
            console.error('Error fetching products:', error);
            return response.status(500).send('Error fetching products');
        }

        if (!request.session.cart) {
            request.session.cart = [];
        }

        const userId = request.session.userId;
        const getOrdersQuery = 'SELECT o.*, p.product_image FROM orders o JOIN product p ON o.product_id = p.product_id WHERE user_id = ?';
        connection.query(getOrdersQuery, [userId], (error, orders) => {
            if (error) {
                console.error('Error fetching orders:', error);
                return response.status(500).send('Error fetching orders');
            }

            // Group products by category
            const groupedProducts = products.reduce((acc, product) => {
                const categoryName = product.category_name;
                if (!acc[categoryName]) {
                    acc[categoryName] = [];
                }
                acc[categoryName].push(product);
                return acc;
            }, {});

            // Render the product.ejs template with grouped products, cart, and orders data
            response.render('contact', { 
                groupedProducts: groupedProducts, 
                cart: request.session.cart, 
                orders: orders, 
                cartCount: request.session.cart.length 
            });
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

        // Render the cart.ejs template with products, cart, and orders data
        response.render('cart', { cart: request.session.cart, orders: orders, showSuccessModal: false });
    });
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
    response.redirect("/cart");
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

                    response.render('cart', { cart: request.session.cart, orders: orders, showSuccessModal: true });
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

// Route for Admin Dashboard
app.get('/admin', (req, res) => {
    // Query to fetch monthly orders count
    const monthlyOrdersQuery = `
        SELECT 
            MONTH(transaction_date) AS month,
            COUNT(*) AS orderCount
        FROM 
            orders
        GROUP BY 
            MONTH(transaction_date)
        ORDER BY 
            month
    `;

    connection.query(monthlyOrdersQuery, (error, results) => {
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

                        // Fetch total count of categories
                        const categoriesCountQuery = 'SELECT COUNT(*) AS totalCategories FROM categories';
                        connection.query(categoriesCountQuery, (error, categoriesResult) => {
                            if (error) {
                                console.error('Error fetching categories count:', error);
                                return res.status(500).send('Error fetching categories count');
                            }

                            const totalCategories = categoriesResult[0].totalCategories;

                            const latestUsersQuery = `
                                SELECT *
                                FROM users
                                ORDER BY id DESC
                                LIMIT 3
                            `;

                            connection.query(latestUsersQuery, (error, users) => {
                                if (error) {
                                    console.error('Error fetching latest users:', error);
                                    return res.status(500).send('Error fetching latest users');
                                }

                                res.render('admin', { 
                                    totalProducts, 
                                    totalUsers, 
                                    totalOrders, 
                                    totalSales, 
                                    labels, 
                                    data, 
                                    latestUsers: users,
                                    totalCategories
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});


// Route to serve the admin-product page
app.get('/admin-product', (request, response) => {
    // Fetch products
    const productsQuery = 'SELECT * FROM product WHERE deleted = false';
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

            const cartCount = request.session.cart.length;

            const productsQuery = 'SELECT * FROM product WHERE deleted = false';
            connection.query(productsQuery, (error, products) => {
                if (error) {
                    console.error('Error fetching products:', error);
                    return response.status(500).send('Error fetching products');
                }
                const getCategoriesQuery = 'SELECT * FROM categories';
                connection.query(getCategoriesQuery, (err, categories) => {
                    if (err) {
                        console.error('Error fetching categories:', err);
                        return res.status(500).send('Error fetching categories');
                    }

                response.render('admin-product', { products,categories, cart: request.session.cart, orders, cartCount, showToast: false });
            });
            });
        });
    });
});




// Route to add a new category
app.post('/admin/categories/add', (req, res) => {
    const { name } = req.body;
    const addCategoryQuery = 'INSERT INTO categories (name) VALUES (?)';
    connection.query(addCategoryQuery, [name], (error) => {
        if (error) {
            console.error('Error adding category:', error);
            return res.status(500).send('Error adding category');
        }
        res.redirect('/admin-product');
    });
});

// Route to edit a category name
app.post('/admin/categories/edit/:id',(req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const editCategoryQuery = 'UPDATE categories SET name = ? WHERE id = ?';
    connection.query(editCategoryQuery, [name, id], (error) => {
        if (error) {
            console.error('Error editing category:', error);
            return res.status(500).send('Error editing category');
        }
        res.redirect('/admin-product');
    });
});

app.post('/edit-product', upload.single('product_image'), (req, res) => {
    const { product_id, product_name, product_price, category_id } = req.body;
    let updateProductQuery;
    let queryParams;

    if (req.file) {
        const product_image = req.file.filename;
        updateProductQuery = `
            UPDATE product 
            SET product_name = ?, product_price = ?, product_image = ?, category_id = ?
            WHERE product_id = ?
        `;
        queryParams = [product_name, product_price, product_image, category_id, product_id];
    } else {
        updateProductQuery = `
            UPDATE product 
            SET product_name = ?, product_price = ?, category_id = ?
            WHERE product_id = ?
        `;
        queryParams = [product_name, product_price, category_id, product_id];
    }

    connection.query(updateProductQuery, queryParams, (error, results) => {
        if (error) {
            console.error('Error updating product:', error);
            return res.status(500).send('Error updating product');
        }

        const fetchProductsQuery = 'SELECT * FROM product WHERE deleted = false';
        const fetchCategoriesQuery = 'SELECT * FROM categories';

        connection.query(fetchProductsQuery, (error, products) => {
            if (error) {
                console.error('Error fetching products:', error);
                return res.status(500).send('Error fetching products');
            }

            connection.query(fetchCategoriesQuery, (error, categories) => {
                if (error) {
                    console.error('Error fetching categories:', error);
                    return res.status(500).send('Error fetching categories');
                }

                const userId = req.session.userId;
                const fetchOrdersQuery = 'SELECT o.*, p.product_image FROM orders o JOIN product p ON o.product_id = p.product_id WHERE user_id = ?';
                connection.query(fetchOrdersQuery, [userId], (error, orders) => {
                    if (error) {
                        console.error('Error fetching orders:', error);
                        return res.status(500).send('Error fetching orders');
                    }

                    if (!req.session.cart) {
                        req.session.cart = [];
                    }

                    const cartCount = req.session.cart.length;
                    

                    res.render('admin-product', { 
                        products, 
                        categories, 
                        cart: req.session.cart, 
                        orders, 
                        cartCount, 
                        showToast: true, 
                        message: 'Product updated successfully' 
                    });
                });
            });
        });
    });
});

app.post('/add-product', upload.single('product_image'), (req, res) => {
    const { product_name, product_price, category_id } = req.body;
    const product_image = req.file.filename;

    const insertProductQuery = 'INSERT INTO product (product_name, product_price, product_image, category_id) VALUES (?, ?, ?, ?)';
    connection.query(insertProductQuery, [product_name, product_price, product_image, category_id], (err, result) => {
        if (err) {
            console.error('Error adding product:', err);
            return res.status(500).send('Error adding product');
        }

        const fetchProductsQuery = 'SELECT * FROM product WHERE deleted = false';
        const fetchCategoriesQuery = 'SELECT * FROM categories';

        connection.query(fetchProductsQuery, (err, products) => {
            if (err) {
                console.error('Error fetching products:', err);
                return res.status(500).send('Error fetching products');
            }

            connection.query(fetchCategoriesQuery, (err, categories) => {
                if (err) {
                    console.error('Error fetching categories:', err);
                    return res.status(500).send('Error fetching categories');
                }

                const userId = req.session.userId;
                const fetchOrdersQuery = 'SELECT o.*, p.product_image FROM orders o JOIN product p ON o.product_id = p.product_id WHERE user_id = ?';
                connection.query(fetchOrdersQuery, [userId], (err, orders) => {
                    if (err) {
                        console.error('Error fetching orders:', err);
                        return res.status(500).send('Error fetching orders');
                    }

                    if (!req.session.cart) {
                        req.session.cart = [];
                    }

                    const cartCount = req.session.cart.length;

                    res.render('admin-product', { 
                        products, 
                        categories, 
                        cart: req.session.cart, 
                        orders, 
                        cartCount, 
                        showToast: true, 
                        message: 'Added successfully' 
                    });
                });
            });
        });
    });
});



app.post('/delete-product', (req, res) => {
    const productId = req.body.product_id;
    const softDeleteProductQuery = 'UPDATE product SET deleted = true WHERE product_id = ?';

    connection.query(softDeleteProductQuery, [productId], (error, results) => {
        if (error) {
            console.error('Error soft deleting product:', error);
            return res.status(500).send('Error soft deleting product');
        }

        const fetchProductsQuery = 'SELECT * FROM product WHERE deleted = false';
        connection.query(fetchProductsQuery, (err, products) => {
            if (err) {
                console.error('Error fetching products:', err);
                return res.status(500).send('Error fetching products');
            }

            const userId = req.session.userId;
            const fetchOrdersQuery = 'SELECT o.*, p.product_image FROM orders o JOIN product p ON o.product_id = p.product_id WHERE user_id = ?';
            connection.query(fetchOrdersQuery, [userId], (err, orders) => {
                if (err) {
                    console.error('Error fetching orders:', err);
                    return res.status(500).send('Error fetching orders');
                }

                if (!req.session.cart) {
                    req.session.cart = [];
                }

                const cartCount = req.session.cart.length;
                const getCategoriesQuery = 'SELECT * FROM categories';
                connection.query(getCategoriesQuery, (err, categories) => {
                    if (err) {
                        console.error('Error fetching categories:', err);
                        return res.status(500).send('Error fetching categories');
                    }


                res.render('admin-product', { 
                    products, 
                    cart: req.session.cart, 
                    orders, 
                    cartCount, 
                    categories,
                    showToast: true, 
                    message: 'Deleted successfully' 
                });
                });
            });
        });
    });
});



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






// Route to fetch orders for a specific user
app.get('/orders', (req, res) => {
    const userId = req.session.userId; // Assuming the user ID is stored in the session

    // Query to fetch orders for the logged-in user
    const getOrdersQuery = 'SELECT * FROM orders';

    connection.query(getOrdersQuery, (error, orders) => {
        if (error) {
            console.error('Error fetching orders:', error);
            return res.status(500).send('Error fetching orders');
        }

        res.render('admin-orders', { orders,showToast:false }); // Render the orders view with the fetched orders data
    });
});

// Route to update order status
app.post('/update-order-status', (req, res) => {
    const userId = req.session.userId;
    const { orderId } = req.body; // Extract orderId from the request body
    const newStatus = req.body.status; // Extract the checked radio button value from the request body

    // Update the order status in the database
    const updateStatusQuery = 'UPDATE orders SET status = ? WHERE order_id = ?';
    connection.query(updateStatusQuery, [newStatus, orderId], (error, results) => {
        if (error) {
            console.error('Error updating order status:', error);
            return res.status(500).send('Error updating order status');
        }

        // Query to fetch orders for the logged-in user
    const getOrdersQuery = 'SELECT * FROM orders';

    connection.query(getOrdersQuery, (error, orders) => {
        if (error) {
            console.error('Error fetching orders:', error);
            return res.status(500).send('Error fetching orders');
        }

        res.render('admin-orders', { orders,showToast:true,message:'Status Updated' }); // Render the orders view with the fetched orders data
    });
        
        
       
       
    });
});










// Route to load 
app.get("/users", (request, response) => {
    // Fetch orders for the logged-in user from the database
    const userId = request.session.userId;
    const latestUsersQuery = `
                        SELECT *
                        FROM users
                        ORDER BY id DESC
                        
                    `;
                
                    connection.query(latestUsersQuery, (error, users) => {
                        if (error) {
                            console.error('Error fetching latest users:', error);
                            return res.status(500).send('Error fetching latest users');
                        }

        // Render the cart.ejs template with products, cart, and orders data
        response.render('admin-users', { latestUsers: users, showToast: false });
    });
});
// Route to render the user profile page
app.get("/profile", (request, response) => {
    // Check if the user is logged in (authenticated)
    if (!request.session.userId) {
        // If the user is not logged in, redirect to the login page
        return response.redirect('/login');
    }

    // Fetch user information from the database based on the user ID stored in the session
    const userId = request.session.userId;
    const getUserQuery = 'SELECT * FROM users WHERE id = ?';
    const getTotalOrdersQuery = 'SELECT COUNT(*) AS totalOrders FROM orders WHERE user_id = ?';

    connection.query(getUserQuery, [userId], (error, user) => {
        if (error) {
            console.error('Error fetching user information:', error);
            return response.status(500).send('Error fetching user information');
        }

        connection.query(getTotalOrdersQuery, [userId], (error, ordersResult) => {
            if (error) {
                console.error('Error fetching total orders:', error);
                return response.status(500).send('Error fetching total orders');
            }

            // Calculate the total cart value based on the items stored in the session
            let totalCartValue = 0;
            if (request.session.cart) {
                request.session.cart.forEach(item => {
                    totalCartValue += item.product_price * item.quantity;
                });
            }

            const totalOrders = ordersResult[0].totalOrders;

            // Render the profile.ejs template with the user's data, total orders, and total cart value
            response.render('profile', {
                user: user[0], 
                totalOrders: totalOrders,
                totalCartValue:request.session.cart.length
            });
        });
    });
});


// Edit profile route
app.post('/edit-profile', uploadprof.single('profile_image'), (req, res) => {
    const { id, name, email, address } = req.body;
    const profileImage = req.file ? req.file.filename : null;

    let updateUserQuery;
    let queryParams;

    if (profileImage) {
        updateUserQuery = 'UPDATE users SET user = ?, email = ?, address = ?, profile_image = ? WHERE id = ?';
        queryParams = [name, email, address, profileImage, id];
    } else {
        updateUserQuery = 'UPDATE users SET user = ?, email = ?, address = ? WHERE id = ?';
        queryParams = [name, email, address, id];
    }

    connection.query(updateUserQuery, queryParams, (error, result) => {
        if (error) {
            console.error('Error updating user:', error);
            return res.status(500).send('Error updating user');
        }

        res.redirect('/profile');
    });
});

// Route to handle password edit
app.post('/edit-password', (req, res) => {
    const { id, password, retype_password } = req.body;

    // Check if the new password and retype password match
    if (password !== retype_password) {
        return res.status(400).send('Passwords do not match');
    }

    // Hash the new password
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.status(500).send('Server error');
        }

        // Update the user's password in the database
        const updatePasswordQuery = 'UPDATE users SET password = ? WHERE id = ?';
        connection.query(updatePasswordQuery, [hash, id], (error, result) => {
            if (error) {
                console.error('Error updating password:', error);
                return res.status(500).send('Error updating password');
            }

            // Redirect to the profile page after successful password update
            res.redirect('/profile');
        });
    });
});


// Route to handle user edit
app.post('/edit-user', (req, res) => {
    const { id, name, email, address } = req.body;

    const updateUserQuery = `
        UPDATE users
        SET user = ?, email = ?, address = ?
        WHERE id = ?
    `;

    connection.query(updateUserQuery, [name, email, address, id], (error, result) => {
        if (error) {
            console.error('Error updating user:', error);
            return res.status(500).send('Error updating user');
        }

        res.redirect('/users');
    });
});

// Route to handle signup form submission
app.post('/signup', uploadprof.single('profile_image'), (req, res) => {
    const { name, email, password, address } = req.body;
    const profileImage = req.file.filename; // Get the filename of the uploaded image

    // Hash the password and insert the user into the database
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.status(500).send('Server error');
        }

        const query = 'INSERT INTO users (user, profile_image, email, password, address) VALUES (?, ?, ?, ?, ?)';
        connection.query(query, [name, profileImage, email, hash, address], (err, result) => {
            if (err) {
                console.error('Error inserting user:', err);
                return res.status(500).send('Server error');
            }

            // Redirect to login page after successful signup
            res.redirect('/');
        });
    });
});



app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});



