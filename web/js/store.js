const Store = (() => {
  const KEY = "carnival-pos-web";
  const cart = {};

  function emptyDb() {
    return {
      nextStallId: 1,
      nextItemId: 1,
      nextOrderId: 1,
      nextOrderItemId: 1,
      stalls: [],
      items: [],
      orders: [],
      orderItems: [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyDb();
      return { ...emptyDb(), ...JSON.parse(raw) };
    } catch {
      return emptyDb();
    }
  }

  function save(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  async function hashPassword(password) {
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function money(value) {
    return Math.round(Number(value) * 1000) / 1000;
  }

  function getStalls() {
    return load()
      .stalls.slice()
      .sort((a, b) => a.stall_name.localeCompare(b.stall_name));
  }

  function getStall(stallId) {
    return load().stalls.find((stall) => stall.stall_id === stallId) || null;
  }

  async function createStall(stallName, password, stallType) {
    const name = stallName.trim();
    const type = (stallType || "food").trim() || "food";
    if (!name || !password.trim()) {
      throw new Error("Name and password are required.");
    }

    const db = load();
    const taken = db.stalls.some(
      (stall) => stall.stall_name.toLowerCase() === name.toLowerCase()
    );
    if (taken) {
      throw new Error("A stall with that name already exists.");
    }

    const stall = {
      stall_id: db.nextStallId,
      stall_name: name,
      password_hash: await hashPassword(password),
      stall_type: type,
    };
    db.nextStallId += 1;
    db.stalls.push(stall);
    save(db);
    return stall.stall_id;
  }

  async function verifyStallPassword(stallId, password) {
    const stall = load().stalls.find((row) => row.stall_id === stallId);
    if (!stall) return false;
    return stall.password_hash === (await hashPassword(password));
  }

  function parseItemFields(name, price, description) {
    const itemName = name.trim();
    if (!itemName || price === "" || price == null) {
      throw new Error("Name and price are required.");
    }
    const parsed = Number(price);
    if (Number.isNaN(parsed)) {
      throw new Error("Please enter a valid numeric price.");
    }
    if (parsed < 0) {
      throw new Error("Price cannot be negative.");
    }
    return {
      item_name: itemName,
      price: money(parsed),
      description: (description || "").trim(),
    };
  }

  function addItem(stallId, name, price, description, imagePath = "") {
    const fields = parseItemFields(name, price, description);
    const db = load();
    const item = {
      item_id: db.nextItemId,
      stall_id: stallId,
      ...fields,
      image_path: imagePath,
      is_active: 1,
    };
    db.nextItemId += 1;
    db.items.push(item);
    save(db);
    return item.item_id;
  }

  function updateItem(itemId, name, price, description, imagePath) {
    const fields = parseItemFields(name, price, description);
    const db = load();
    const item = db.items.find((row) => row.item_id === itemId);
    if (!item) {
      throw new Error("That item no longer exists.");
    }
    item.item_name = fields.item_name;
    item.price = fields.price;
    item.description = fields.description;
    if (imagePath !== undefined) {
      item.image_path = imagePath;
    }
    save(db);
  }

  function updateItemImage(itemId, imagePath) {
    const db = load();
    const item = db.items.find((row) => row.item_id === itemId);
    if (!item) {
      throw new Error("That item no longer exists.");
    }
    item.image_path = imagePath;
    save(db);
  }

  function hideItem(itemId) {
    const db = load();
    const item = db.items.find((row) => row.item_id === itemId);
    if (!item) {
      throw new Error("That item no longer exists.");
    }
    item.is_active = 0;
    save(db);
  }

  function getItems(stallId) {
    return load()
      .items.filter((item) => item.stall_id === stallId && item.is_active === 1)
      .sort((a, b) => a.item_name.localeCompare(b.item_name));
  }

  function getItem(itemId) {
    return load().items.find((item) => item.item_id === itemId) || null;
  }

  function addToOrder(itemId) {
    const item = getItem(itemId);
    if (!item || item.is_active === 0) return false;
    cart[itemId] = (cart[itemId] || 0) + 1;
    return true;
  }

  function removeFromOrder(itemId) {
    if (!(itemId in cart)) return;
    if (cart[itemId] === 1) {
      delete cart[itemId];
    } else {
      cart[itemId] -= 1;
    }
  }

  function clearOrder() {
    Object.keys(cart).forEach((key) => delete cart[key]);
  }

  function getCartDetails() {
    const lines = Object.entries(cart)
      .map(([itemId, quantity]) => {
        const item = getItem(Number(itemId));
        if (!item) return null;
        return {
          item_id: item.item_id,
          item_name: item.item_name,
          quantity,
          unit_price: item.price,
          subtotal: money(item.price * quantity),
        };
      })
      .filter(Boolean);

    const total = money(lines.reduce((sum, line) => sum + line.subtotal, 0));
    return { items: lines, total };
  }

  function completeOrder(stallId) {
    const snapshot = getCartDetails();
    if (!snapshot.items.length) {
      throw new Error("Please add items to cart before completing order.");
    }

    const db = load();
    for (const line of snapshot.items) {
      const item = db.items.find((row) => row.item_id === line.item_id);
      if (!item) {
        throw new Error("An item in the cart no longer exists.");
      }
      if (item.stall_id !== stallId) {
        throw new Error("The cart contains an item belonging to another stall.");
      }
    }

    const orderId = db.nextOrderId;
    db.nextOrderId += 1;
    db.orders.push({
      order_id: orderId,
      stall_id: stallId,
      total_price: snapshot.total,
      timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
    });

    snapshot.items.forEach((line) => {
      db.orderItems.push({
        order_item_id: db.nextOrderItemId,
        order_id: orderId,
        item_id: line.item_id,
        quantity: line.quantity,
        unit_price: line.unit_price,
      });
      db.nextOrderItemId += 1;
    });

    save(db);
    clearOrder();

    const stall = getStall(stallId);
    return {
      order_id: orderId,
      stall_name: stall ? stall.stall_name : "",
      items: snapshot.items,
      total: snapshot.total,
    };
  }

  async function ensureInitialData() {
    if (getStalls().length) return;

    const burgerId = await createStall("Burger Station", "burger123", "food");
    addItem(burgerId, "Classic Cheeseburger", 3.5, "Beef patty with cheddar & sauce");
    addItem(burgerId, "Double Patty Burger", 4.75, "Two patties, extra cheese & bacon");
    addItem(burgerId, "Crispy French Fries", 1.25, "Golden salted potato fries");
    addItem(burgerId, "Soft Drink", 0.75, "Chilled soda can");

    const sweetId = await createStall("Sweet Treats", "sweet123", "dessert");
    addItem(sweetId, "Chocolate Ice Cream", 1.5, "Rich creamy chocolate cone");
    addItem(sweetId, "Cotton Candy", 1.0, "Pink sugar cloud on a stick");
    addItem(sweetId, "Churros with Nutella", 2.25, "Cinnamon churros with dip");
  }

  return {
    getStalls,
    getStall,
    createStall,
    verifyStallPassword,
    addItem,
    updateItem,
    updateItemImage,
    hideItem,
    getItems,
    addToOrder,
    removeFromOrder,
    clearOrder,
    getCartDetails,
    completeOrder,
    ensureInitialData,
  };
})();
