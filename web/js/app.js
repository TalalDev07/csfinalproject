const state = {
  stall: null,
  search: "",
  tab: "register",
};

const loginScreen = document.getElementById("login-screen");
const posScreen = document.getElementById("pos-screen");
const stallSelect = document.getElementById("stall-select");
const passwordInput = document.getElementById("password-input");
const loginError = document.getElementById("login-error");
const menuList = document.getElementById("menu-list");
const menuSearch = document.getElementById("menu-search");
const menuCount = document.getElementById("menu-count");
const cartList = document.getElementById("cart-list");
const cartTotal = document.getElementById("cart-total");
const stallTitle = document.getElementById("stall-title");
const stallType = document.getElementById("stall-type");
const modalRoot = document.getElementById("modal-root");
const modalBox = document.getElementById("modal-box");
const registerView = document.getElementById("register-view");
const statsView = document.getElementById("stats-view");
const tabRegister = document.getElementById("tab-register");
const tabStats = document.getElementById("tab-stats");
const addItemBtn = document.getElementById("add-item-btn");
const statsKpis = document.getElementById("stats-kpis");
const statsSubtitle = document.getElementById("stats-subtitle");
const statsTable = document.getElementById("stats-table");
const chartItems = document.getElementById("chart-items");
const chartDays = document.getElementById("chart-days");

function money(value) {
  return Number(value).toFixed(3);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showError(message) {
  loginError.hidden = !message;
  loginError.textContent = message || "";
}

function showScreen(name) {
  loginScreen.hidden = name !== "login";
  posScreen.hidden = name !== "pos";
}

function closeModal() {
  modalRoot.hidden = true;
  modalBox.innerHTML = "";
}

function openModal(html) {
  modalBox.innerHTML = html;
  modalRoot.hidden = false;
}

function loadStalls() {
  const stalls = Store.getStalls();
  stallSelect.innerHTML = "";

  if (!stalls.length) {
    const option = document.createElement("option");
    option.textContent = "No stalls available";
    stallSelect.appendChild(option);
    return [];
  }

  stalls.forEach((stall) => {
    const option = document.createElement("option");
    option.value = stall.stall_id;
    option.textContent = `${stall.stall_name} (${stall.stall_type})`;
    stallSelect.appendChild(option);
  });
  return stalls;
}

async function login() {
  showError("");
  const stallId = Number(stallSelect.value);
  const password = passwordInput.value;

  if (!Store.getStalls().length) {
    showError("No stalls exist. Please create one.");
    return;
  }
  if (!stallId) {
    showError("Please choose a stall from the list.");
    return;
  }
  if (!password) {
    showError("Please enter the stall password.");
    return;
  }

  const ok = await Store.verifyStallPassword(stallId, password);
  if (!ok) {
    showError("Incorrect password. Try again.");
    return;
  }

  Store.clearOrder();
  enterPos(Store.getStall(stallId));
}

async function quickLogin() {
  showError("");
  await Store.ensureInitialData();
  const stalls = loadStalls();
  if (!stalls.length) {
    showError("No stalls exist. Please create one.");
    return;
  }
  Store.clearOrder();
  enterPos(stalls[0]);
}

function enterPos(stall) {
  state.stall = stall;
  state.search = "";
  stallTitle.textContent = stall.stall_name;
  stallType.textContent = stall.stall_type.toUpperCase();
  passwordInput.value = "";
  menuSearch.value = "";
  showScreen("pos");
  showTab("register");
  loadMenu();
  loadCart();
}

function showTab(name) {
  state.tab = name;
  registerView.hidden = name !== "register";
  statsView.hidden = name !== "stats";
  addItemBtn.hidden = name !== "register";
  tabRegister.classList.toggle("is-active", name === "register");
  tabStats.classList.toggle("is-active", name === "stats");
  if (name === "stats") loadStats();
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const max = 360;
      let { width, height } = image;
      if (width > max || height > max) {
        const scale = max / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read that image."));
    };
    image.src = objectUrl;
  });
}

function pickImage(onPicked) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", async () => {
    try {
      const dataUrl = await readImageFile(input.files[0]);
      if (dataUrl) onPicked(dataUrl);
    } catch (error) {
      window.alert(error.message);
    }
  });
  input.click();
}

function stockClass(available) {
  if (available <= 0) return "is-out";
  if (available <= 5) return "is-low";
  return "";
}

function stockLabel(available, total) {
  if (available <= 0) return "Out of stock";
  if (available !== total) return `${available} left of ${total}`;
  return `${total} in stock`;
}

function itemPhotoHtml(item) {
  if (item.image_path) {
    return `<img class="item-photo" src="${item.image_path}" alt="${escapeHtml(item.item_name)}" data-photo>`;
  }
  return `<button class="photo-fallback" type="button" data-photo>Add photo</button>`;
}

function loadMenu() {
  const items = Store.getItems(state.stall.stall_id);
  const query = state.search.trim().toLowerCase();
  const visible = items.filter((item) => {
    if (!query) return true;
    const haystack = `${item.item_name} ${item.description || ""}`.toLowerCase();
    return haystack.includes(query);
  });

  menuList.innerHTML = "";
  if (!items.length) {
    menuCount.textContent = "";
    menuList.innerHTML = `<p class="empty">No active menu items found. Click "Add Menu Item" to add food or drink items.</p>`;
    return;
  }

  menuCount.textContent = query
    ? `Showing ${visible.length} of ${items.length} items`
    : `${items.length} items`;

  if (!visible.length) {
    menuList.innerHTML = `<p class="empty">No items match "${escapeHtml(state.search)}".</p>`;
    return;
  }

  visible.forEach((item) => {
    const available = Store.getAvailableStock(item.item_id);
    const card = document.createElement("article");
    card.className = "item-card";
    card.innerHTML = `
      ${itemPhotoHtml(item)}
      <div class="item-copy">
        <h4>${escapeHtml(item.item_name)}</h4>
        <p class="muted">${escapeHtml(item.description || "")}</p>
        <p class="price">KWD ${money(item.price)}</p>
        <div class="stock-row">
          <span class="stock-badge ${stockClass(available)}">${stockLabel(available, item.stock)}</span>
          <label class="stock-editor">
            Stock
            <input data-stock type="number" min="0" step="1" value="${item.stock}">
          </label>
        </div>
        <button class="photo-action" type="button" data-photo>${item.image_path ? "Change photo" : "Add photo"}</button>
      </div>
      <div class="item-actions">
        <button class="btn btn-ghost btn-compact" type="button" data-edit>Edit</button>
        <button class="btn btn-primary btn-compact" type="button" data-add ${available ? "" : "disabled"}>+ Add</button>
      </div>
    `;
    card.querySelector("[data-add]").addEventListener("click", () => addItem(item.item_id));
    card.querySelector("[data-edit]").addEventListener("click", () => openEditItem(item));
    card.querySelector("[data-stock]").addEventListener("change", (event) => {
      try {
        Store.updateStock(item.item_id, event.target.value);
        loadMenu();
        loadCart();
      } catch (error) {
        window.alert(error.message);
        loadMenu();
      }
    });
    card.querySelectorAll("[data-photo]").forEach((button) => {
      button.addEventListener("click", () => {
        pickImage((imagePath) => {
          Store.updateItemImage(item.item_id, imagePath);
          loadMenu();
        });
      });
    });
    menuList.appendChild(card);
  });
}

function loadCart() {
  const cart = Store.getCartDetails();
  cartList.innerHTML = "";
  cartTotal.textContent = `Total: KWD ${money(cart.total)}`;

  if (!cart.items.length) {
    cartList.innerHTML = `<p class="empty">Cart is empty. Click "+ Add" on menu items.</p>`;
    return;
  }

  cart.items.forEach((line) => {
    const row = document.createElement("article");
    row.className = "cart-row";
    row.innerHTML = `
      <div>
        <h4>${escapeHtml(line.item_name)}</h4>
        <p class="muted">KWD ${money(line.subtotal)} (@ ${money(line.unit_price)})</p>
      </div>
      <div class="qty-controls">
        <button class="btn btn-ghost" type="button">-</button>
        <strong>${line.quantity}</strong>
        <button class="btn btn-ghost" type="button">+</button>
      </div>
    `;
    const [minus, plus] = row.querySelectorAll("button");
    minus.addEventListener("click", () => removeItem(line.item_id));
    plus.addEventListener("click", () => addItem(line.item_id));
    cartList.appendChild(row);
  });
}

function addItem(itemId) {
  if (!Store.addToOrder(itemId)) {
    window.alert("Not enough stock for that item.");
    loadMenu();
    return;
  }
  loadCart();
  loadMenu();
}

function removeItem(itemId) {
  Store.removeFromOrder(itemId);
  loadCart();
  loadMenu();
}

function cancelOrder() {
  const cart = Store.getCartDetails();
  if (!cart.items.length) return;
  if (!window.confirm("Clear current order?")) return;
  Store.clearOrder();
  loadCart();
  loadMenu();
}

function saveReceiptImage(receipt) {
  const orderNo = String(receipt.order_id).padStart(4, "0");
  const width = 420;
  const lineHeight = 28;
  const height = 250 + receipt.items.length * lineHeight;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#fffaf2";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#1f3554";
  ctx.fillRect(0, 0, width, 10);
  ctx.fillStyle = "#c5922a";
  ctx.fillRect(18, 0, 10, 10);
  ctx.fillStyle = "#c23b22";
  ctx.fillRect(28, 0, 12, 10);

  ctx.fillStyle = "#23180f";
  ctx.textAlign = "center";
  ctx.font = "700 22px 'Courier New', monospace";
  ctx.fillText("CARNIVAL RECEIPT", width / 2, 48);
  ctx.font = "16px 'Courier New', monospace";
  ctx.fillText(receipt.stall_name.toUpperCase(), width / 2, 74);
  ctx.font = "700 15px 'Courier New', monospace";
  ctx.fillText(`Order Number: #${orderNo}`, width / 2, 98);

  ctx.strokeStyle = "#d7c7ad";
  ctx.beginPath();
  ctx.moveTo(28, 112);
  ctx.lineTo(width - 28, 112);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.font = "14px 'Courier New', monospace";
  receipt.items.forEach((item, index) => {
    const y = 140 + index * lineHeight;
    ctx.fillText(`${item.quantity}x ${item.item_name}`.slice(0, 28), 28, y);
    ctx.textAlign = "right";
    ctx.fillText(`KWD ${money(item.subtotal)}`, width - 28, y);
    ctx.textAlign = "left";
  });

  const totalY = 160 + receipt.items.length * lineHeight;
  ctx.beginPath();
  ctx.moveTo(28, totalY - 16);
  ctx.lineTo(width - 28, totalY - 16);
  ctx.stroke();
  ctx.font = "700 18px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "#2f6d4f";
  ctx.fillText(`TOTAL PAID: KWD ${money(receipt.total)}`, width / 2, totalY + 10);
  ctx.fillStyle = "#7a6854";
  ctx.font = "13px 'Courier New', monospace";
  ctx.fillText("Thank you for visiting!", width / 2, totalY + 36);
  ctx.fillText("Enjoy the Carnival!", width / 2, totalY + 54);

  const link = document.createElement("a");
  link.download = `carnival-receipt-${orderNo}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function completeOrder() {
  try {
    const receipt = Store.completeOrder(state.stall.stall_id);
    loadCart();
    loadMenu();
    const lines = receipt.items
      .map(
        (item) => `
        <div class="receipt-line">
          <span>${item.quantity}x ${escapeHtml(item.item_name)}</span>
          <span>KWD ${money(item.subtotal)}</span>
        </div>
      `
      )
      .join("");
    openModal(`
      <div class="receipt">
        <h3>Carnival Receipt</h3>
        <p>${escapeHtml(receipt.stall_name)}</p>
        <p><strong>Order Number: #${String(receipt.order_id).padStart(4, "0")}</strong></p>
        ${lines}
        <p class="total">TOTAL PAID: KWD ${money(receipt.total)}</p>
        <p class="muted">Thank you for visiting! Enjoy the Carnival!</p>
        <div class="receipt-actions">
          <button id="save-receipt-btn" class="btn btn-ghost" type="button">Save Receipt</button>
          <button id="next-order-btn" class="btn btn-primary" type="button">Next Order</button>
        </div>
      </div>
    `);
    document.getElementById("save-receipt-btn").addEventListener("click", () => saveReceiptImage(receipt));
    document.getElementById("next-order-btn").addEventListener("click", closeModal);
  } catch (error) {
    window.alert(error.message);
  }
}

function switchStall() {
  const cart = Store.getCartDetails();
  if (cart.items.length) {
    const ok = window.confirm(
      "You have items in your cart. Returning will clear the active order. Continue?"
    );
    if (!ok) return;
    Store.clearOrder();
  }
  state.stall = null;
  showScreen("login");
  loadStalls();
}

function openCreateStall() {
  openModal(`
    <h3>Create New Stall</h3>
    <label for="new-stall-name">Stall name</label>
    <input id="new-stall-name" type="text">
    <label for="new-stall-password">Password</label>
    <input id="new-stall-password" type="password">
    <label for="new-stall-type">Stall type</label>
    <input id="new-stall-type" type="text" value="food">
    <p id="modal-error" class="error" hidden></p>
    <button id="save-stall-btn" class="btn btn-primary btn-block" type="button">Create Stall</button>
  `);

  document.getElementById("save-stall-btn").addEventListener("click", async () => {
    const errorEl = document.getElementById("modal-error");
    try {
      await Store.createStall(
        document.getElementById("new-stall-name").value,
        document.getElementById("new-stall-password").value,
        document.getElementById("new-stall-type").value
      );
      closeModal();
      loadStalls();
    } catch (error) {
      errorEl.hidden = false;
      errorEl.textContent = error.message;
    }
  });
}

function bindItemForm(initialImage, onSave) {
  let imagePath = initialImage || "";
  const preview = document.getElementById("item-preview");
  const errorEl = document.getElementById("modal-error");

  document.getElementById("item-image").addEventListener("change", async (event) => {
    try {
      const nextImage = await readImageFile(event.target.files[0]);
      if (nextImage) {
        imagePath = nextImage;
        preview.innerHTML = `<img src="${imagePath}" alt="Item preview">`;
      }
      errorEl.hidden = true;
    } catch (error) {
      errorEl.hidden = false;
      errorEl.textContent = error.message;
    }
  });

  document.getElementById("save-item-btn").addEventListener("click", () => {
    try {
      onSave({
        name: document.getElementById("item-name").value,
        price: document.getElementById("item-price").value,
        description: document.getElementById("item-desc").value,
        stock: document.getElementById("item-stock").value,
        imagePath,
      });
      closeModal();
      loadMenu();
      loadCart();
    } catch (error) {
      errorEl.hidden = false;
      errorEl.textContent = error.message;
    }
  });
}

function itemFormHtml({ title, name, price, description, stock, imagePath, saveLabel, extra = "" }) {
  const preview = imagePath
    ? `<img src="${imagePath}" alt="Item preview">`
    : "Optional photo";
  return `
    <h3>${title}</h3>
    <label for="item-name">Item name</label>
    <input id="item-name" type="text" value="${escapeHtml(name || "")}">
    <label for="item-price">Price (e.g. 2.500)</label>
    <input id="item-price" type="text" value="${escapeHtml(price || "")}">
    <label for="item-stock">Stock count</label>
    <input id="item-stock" type="number" min="0" step="1" value="${escapeHtml(stock ?? 20)}">
    <label for="item-desc">Description</label>
    <input id="item-desc" type="text" value="${escapeHtml(description || "")}">
    <label for="item-image">Item photo</label>
    <div class="image-picker">
      <input id="item-image" type="file" accept="image/*">
      <div id="item-preview" class="image-preview">${preview}</div>
    </div>
    <p id="modal-error" class="error" hidden></p>
    ${extra}
    <button id="save-item-btn" class="btn btn-primary btn-block" type="button">${saveLabel}</button>
  `;
}

function openAddItem() {
  openModal(itemFormHtml({
    title: "Add New Menu Item",
    saveLabel: "Save Menu Item",
  }));
  bindItemForm("", ({ name, price, description, imagePath, stock }) => {
    Store.addItem(state.stall.stall_id, name, price, description, imagePath, stock);
  });
}

function openEditItem(item) {
  openModal(itemFormHtml({
    title: "Edit Menu Item",
    name: item.item_name,
    price: money(item.price),
    description: item.description,
    stock: item.stock,
    imagePath: item.image_path,
    saveLabel: "Save Changes",
    extra: `<button id="hide-item-btn" class="btn btn-ghost btn-block" type="button">Hide from menu</button>`,
  }));

  bindItemForm(item.image_path, ({ name, price, description, imagePath, stock }) => {
    Store.updateItem(item.item_id, name, price, description, imagePath, stock);
  });

  document.getElementById("hide-item-btn").addEventListener("click", () => {
    if (!window.confirm(`Hide "${item.item_name}" from the menu? Old receipts keep the item.`)) {
      return;
    }
    Store.hideItem(item.item_id);
    closeModal();
    loadMenu();
    loadCart();
  });
}

function loadStats() {
  const stats = Store.getStallStats(state.stall.stall_id);
  statsSubtitle.textContent = `${stats.stall_name} · ${stats.order_count} orders`;
  statsKpis.innerHTML = `
    <article class="kpi"><span>Revenue</span><strong>KWD ${money(stats.revenue)}</strong></article>
    <article class="kpi"><span>Orders</span><strong>${stats.order_count}</strong></article>
    <article class="kpi"><span>Items sold</span><strong>${stats.items_sold}</strong></article>
    <article class="kpi"><span>Avg order</span><strong>KWD ${money(stats.average_order)}</strong></article>
    <article class="kpi"><span>Low stock</span><strong>${stats.low_stock.length}</strong></article>
  `;

  const rows = stats.by_item.length
    ? stats.by_item
        .map(
          (item) => `
        <tr>
          <td>${escapeHtml(item.item_name)}</td>
          <td>${item.quantity}</td>
          <td>KWD ${money(item.revenue)}</td>
          <td>${item.stock}</td>
        </tr>
      `
        )
        .join("")
    : `<tr><td colspan="4">No sales yet for this stall.</td></tr>`;

  statsTable.innerHTML = `
    <table class="stats-table">
      <thead>
        <tr><th>Item</th><th>Sold</th><th>Revenue</th><th>Stock left</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  drawBarChart(
    chartItems,
    stats.by_item.map((item) => ({ label: item.item_name, value: item.quantity })),
    "#1f3554"
  );
  drawBarChart(
    chartDays,
    stats.by_day.map((day) => ({ label: day.date.slice(5) || day.date, value: day.revenue })),
    "#2f6d4f"
  );
}

function drawBarChart(canvas, rows, color) {
  const width = canvas.clientWidth || 320;
  const height = 220;
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fffaf2";
  ctx.fillRect(0, 0, width, height);

  if (!rows.length) {
    ctx.fillStyle = "#7a6854";
    ctx.font = "14px Source Sans 3, sans-serif";
    ctx.fillText("No data yet", 16, height / 2);
    return;
  }

  const top = 16;
  const bottom = height - 36;
  const left = 36;
  const right = width - 12;
  const max = Math.max(...rows.map((row) => row.value), 1);
  const barWidth = Math.max(12, (right - left) / rows.length - 8);

  rows.forEach((row, index) => {
    const barHeight = ((bottom - top) * row.value) / max;
    const x = left + index * ((right - left) / rows.length);
    ctx.fillStyle = color;
    ctx.fillRect(x, bottom - barHeight, barWidth, barHeight);
    ctx.fillStyle = "#7a6854";
    ctx.font = "11px Source Sans 3, sans-serif";
    ctx.fillText(String(row.label).slice(0, 10), x, height - 14);
  });
}

function saveSalesReport(stats) {
  const width = 920;
  const chartH = 200;
  const tableRows = Math.max(stats.by_item.length, 1);
  const height = 430 + tableRows * 28 + chartH;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#fffaf2";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#1f3554";
  ctx.fillRect(0, 0, width, 10);

  ctx.fillStyle = "#23180f";
  ctx.font = "700 28px Fraunces, Georgia, serif";
  ctx.fillText("Carnival Sales Report", 36, 56);
  ctx.font = "16px Source Sans 3, sans-serif";
  ctx.fillStyle = "#7a6854";
  ctx.fillText(`${stats.stall_name}  ·  ${new Date().toLocaleString()}`, 36, 82);

  const kpis = [
    ["Revenue", `KWD ${money(stats.revenue)}`],
    ["Orders", String(stats.order_count)],
    ["Items sold", String(stats.items_sold)],
    ["Avg order", `KWD ${money(stats.average_order)}`],
  ];
  kpis.forEach((kpi, index) => {
    const x = 36 + index * 215;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#d7c7ad";
    ctx.strokeRect(x, 104, 200, 64);
    ctx.fillStyle = "#7a6854";
    ctx.font = "13px Source Sans 3, sans-serif";
    ctx.fillText(kpi[0], x + 14, 128);
    ctx.fillStyle = "#23180f";
    ctx.font = "700 20px Source Sans 3, sans-serif";
    ctx.fillText(kpi[1], x + 14, 152);
  });

  const chartTop = 192;
  ctx.fillStyle = "#23180f";
  ctx.font = "700 16px Source Sans 3, sans-serif";
  ctx.fillText("Items sold", 36, chartTop);
  const bars = stats.by_item.slice(0, 8);
  const max = Math.max(...bars.map((item) => item.quantity), 1);
  bars.forEach((item, index) => {
    const x = 36 + index * 108;
    const barHeight = (140 * item.quantity) / max;
    ctx.fillStyle = "#1f3554";
    ctx.fillRect(x, chartTop + 20 + (140 - barHeight), 72, barHeight);
    ctx.fillStyle = "#7a6854";
    ctx.font = "11px Source Sans 3, sans-serif";
    ctx.fillText(item.item_name.slice(0, 11), x, chartTop + 178);
    ctx.fillText(String(item.quantity), x, chartTop + 12 + (140 - barHeight));
  });

  const tableTop = chartTop + chartH + 24;
  ctx.fillStyle = "#23180f";
  ctx.font = "700 16px Source Sans 3, sans-serif";
  ctx.fillText("Item breakdown", 36, tableTop);
  ctx.font = "13px Source Sans 3, sans-serif";
  ctx.fillText("Item", 36, tableTop + 28);
  ctx.fillText("Sold", 420, tableTop + 28);
  ctx.fillText("Revenue", 520, tableTop + 28);
  ctx.fillText("Stock left", 700, tableTop + 28);

  (stats.by_item.length ? stats.by_item : [{ item_name: "No sales yet", quantity: 0, revenue: 0, stock: "-" }]).forEach(
    (item, index) => {
      const y = tableTop + 54 + index * 28;
      ctx.fillStyle = "#23180f";
      ctx.fillText(String(item.item_name).slice(0, 36), 36, y);
      ctx.fillText(String(item.quantity), 420, y);
      ctx.fillText(`KWD ${money(item.revenue || 0)}`, 520, y);
      ctx.fillText(String(item.stock), 700, y);
    }
  );

  const link = document.createElement("a");
  const slug = stats.stall_name.toLowerCase().replace(/\s+/g, "-") || "stall";
  link.download = `carnival-sales-${slug}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

document.getElementById("login-btn").addEventListener("click", login);
document.getElementById("quick-login-btn").addEventListener("click", quickLogin);
document.getElementById("create-stall-btn").addEventListener("click", openCreateStall);
document.getElementById("add-item-btn").addEventListener("click", openAddItem);
document.getElementById("cancel-btn").addEventListener("click", cancelOrder);
document.getElementById("checkout-btn").addEventListener("click", completeOrder);
document.getElementById("switch-stall-btn").addEventListener("click", switchStall);
tabRegister.addEventListener("click", () => showTab("register"));
tabStats.addEventListener("click", () => showTab("stats"));
document.getElementById("save-report-btn").addEventListener("click", () => {
  saveSalesReport(Store.getStallStats(state.stall.stall_id));
});
menuSearch.addEventListener("input", () => {
  state.search = menuSearch.value;
  loadMenu();
});
passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});
modalRoot.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-modal]")) closeModal();
});

Store.ensureInitialData().then(loadStalls).catch((error) => showError(error.message));
