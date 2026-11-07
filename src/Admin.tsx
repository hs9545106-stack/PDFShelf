
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  ShoppingCart,
  Users,
  Tags,
  Settings,
  Search,
  Plus,
  Bell,
  Menu,
  IndianRupee,
  Package,
  Download,
  X,
  FileText,
  ChevronDown,
  Pencil,
  Trash2,
  Upload,
  LoaderCircle,
  LogOut,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase-client";
import "./assets/Admin.css";

type Category = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  title: string;
  slug: string;
  category_id: string | null;
  description: string;
  price: number;
  original_price: number | null;
  cover_image_url: string | null;
  file_path: string | null;
  author: string | null;
  pages: number | null;
  language: string | null;
  file_size: number | null;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  created_at: string;
  updated_at: string;
  categoryName?: string;
};

function makeSlug(value: string) {
  const clean = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${clean || "pdf"}-${Date.now()}`;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "Unknown size";

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getCoverPath(url: string | null) {
  if (!url) return null;

  const marker = "/storage/v1/object/public/product-covers/";
  const position = url.indexOf(marker);

  if (position === -1) return null;

  return decodeURIComponent(url.substring(position + marker.length));
}

function Admin() {
  const navigate = useNavigate();

  const [active, setActive] = useState("Overview");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [message, setMessage] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [pages, setPages] = useState("");
  const [language, setLanguage] = useState("English");
  const [status, setStatus] = useState<"draft" | "published">("draft");

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [mobileOpen, setMobileOpen] = useState(false);

  const navigation = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Products", icon: BookOpen },
    { label: "Orders", icon: ShoppingCart },
    { label: "Customers", icon: Users },
    { label: "Categories", icon: Tags },
  ];

  const publishedCount = products.filter(
    (product) => product.status === "published"
  ).length;

  const filtered = useMemo(
    () =>
      products.filter((product) =>
        product.title.toLowerCase().includes(search.toLowerCase())
      ),
    [products, search]
  );

  // Load real products and categories from Supabase.
  async function loadData() {
    setLoading(true);
    setPageError("");

    try {
      const [productResult, categoryResult] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("categories")
          .select("id, name")
          .order("name", { ascending: true }),
      ]);

      if (productResult.error) throw productResult.error;
      if (categoryResult.error) throw categoryResult.error;

      const categoryList = (categoryResult.data || []) as Category[];

      const categoryMap = new Map(
        categoryList.map((category) => [category.id, category.name])
      );

      const productList = (productResult.data || []).map((product) => ({
        ...product,
        categoryName: product.category_id
          ? categoryMap.get(product.category_id) || "Uncategorised"
          : "Uncategorised",
      })) as Product[];

      setCategories(categoryList);
      setProducts(productList);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to load products from Supabase."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function resetForm() {
    setEditingProduct(null);
    setName("");
    setCategoryId("");
    setDescription("");
    setAuthor("");
    setPages("");
    setLanguage("English");
    setStatus("draft");
    setPdfFile(null);
    setCoverFile(null);
  }

  function openAddModal() {
    resetForm();
    setPageError("");
    setMessage("");
    setShowModal(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setName(product.title);
    setCategoryId(product.category_id || "");
    setDescription(product.description || "");
    setAuthor(product.author || "");
    setPages(product.pages == null ? "" : String(product.pages));
    setLanguage(product.language || "English");
    setStatus(product.status === "published" ? "published" : "draft");
    setPdfFile(null);
    setCoverFile(null);
    setPageError("");
    setMessage("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    resetForm();
  }

  async function uploadFile(bucket: string, file: File) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${crypto.randomUUID()}-${safeName}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

    if (error) throw error;

    return path;
  }

  async function handleSaveProduct(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setPageError("");
    setMessage("");

    // PDFShelf uses a voluntary-support model: every PDF is free.

    if (!name.trim()) {
      setPageError("Please enter a product title.");
      return;
    }

    if (pages.trim() && (!Number.isInteger(Number(pages)) || Number(pages) <= 0)) {
      setPageError("Please enter a valid page count.");
      return;
    }

    if (!editingProduct && !pdfFile) {
      setPageError("Please select a PDF document for this product.");
      return;
    }

    if (pdfFile && pdfFile.type !== "application/pdf") {
      setPageError("Only PDF documents are accepted.");
      return;
    }

    if (coverFile && !coverFile.type.startsWith("image/")) {
      setPageError("Please select a valid cover image.");
      return;
    }

    setSaving(true);

    let newPdfPath: string | null = null;
    let newCoverPath: string | null = null;

    try {
      // Upload the PDF to the private bucket.
      if (pdfFile) {
        newPdfPath = await uploadFile("product-pdfs", pdfFile);
      }

      // Upload the cover image to the public bucket.
      if (coverFile) {
        newCoverPath = await uploadFile("product-covers", coverFile);
      }

      let coverUrl = editingProduct?.cover_image_url || null;

      if (newCoverPath) {
        const { data } = supabase.storage
          .from("product-covers")
          .getPublicUrl(newCoverPath);

        coverUrl = data.publicUrl;
      }

      const currentFilePath =
        newPdfPath || editingProduct?.file_path || null;

      const productData = {
        title: name.trim(),
        category_id: categoryId || null,
        description: description.trim(),
        price: 0,
        original_price: null,
        cover_image_url: coverUrl,
        file_path: currentFilePath,
        author: author.trim() || null,
        pages: pages.trim() ? Number(pages) : null,
        language: language.trim() || "English",
        file_size: pdfFile
          ? pdfFile.size
          : editingProduct?.file_size || null,
        status,
        published_at:
          status === "published"
            ? editingProduct?.published_at || new Date().toISOString()
            : null,
        updated_at: new Date().toISOString(),
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert({
          ...productData,
          slug: makeSlug(name),
        });

        if (error) throw error;
      }

      // Remove replaced files only after the database update succeeds.
      if (
        editingProduct?.file_path &&
        newPdfPath &&
        editingProduct.file_path !== newPdfPath
      ) {
        await supabase.storage
          .from("product-pdfs")
          .remove([editingProduct.file_path]);
      }

      if (editingProduct?.cover_image_url && newCoverPath) {
        const oldCoverPath = getCoverPath(editingProduct.cover_image_url);

        if (oldCoverPath) {
          await supabase.storage
            .from("product-covers")
            .remove([oldCoverPath]);
        }
      }

      setShowModal(false);
      resetForm();
      setActive("Products");
      setMessage(
        editingProduct
          ? "Product updated successfully."
          : "Product added successfully."
      );

      await loadData();
    } catch (error) {
      // Clean up new uploads if saving the database record failed.
      if (newPdfPath) {
        await supabase.storage
          .from("product-pdfs")
          .remove([newPdfPath]);
      }

      if (newCoverPath) {
        await supabase.storage
          .from("product-covers")
          .remove([newCoverPath]);
      }

      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to save the product."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product: Product) {
    const confirmed = window.confirm(
      `Delete "${product.title}" permanently? This also removes its stored files.`
    );

    if (!confirmed) return;

    setPageError("");
    setMessage("");

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);

      if (error) throw error;

      const filesToRemove = product.file_path
        ? [product.file_path]
        : [];

      if (filesToRemove.length) {
        const { error: storageError } = await supabase.storage
          .from("product-pdfs")
          .remove(filesToRemove);

        if (storageError) {
          console.error("PDF cleanup failed:", storageError.message);
        }
      }

      const coverPath = getCoverPath(product.cover_image_url);

      if (coverPath) {
        const { error: coverError } = await supabase.storage
          .from("product-covers")
          .remove([coverPath]);

        if (coverError) {
          console.error("Cover cleanup failed:", coverError.message);
        }
      }

      setMessage("Product deleted successfully.");
      await loadData();
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to delete this product."
      );
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setPageError(error.message);
      return;
    }

    navigate("/admin/login", { replace: true });
  }

  const totalProducts = products.length;

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <a href="/" className="admin-brand">
          <span className="admin-brand-icon">
            <BookOpen size={20} />
          </span>
          <span>
            PDF<span>Shelf</span>
          </span>
        </a>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="admin-navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`admin-nav-item ${
                active === label ? "active" : ""
              }`}
              onClick={() => {
                setActive(label);
                setMobileOpen(false);
                setPageError("");
                setMessage("");
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-label">PREFERENCES</div>

          <button
            className={`admin-nav-item ${
              active === "Settings" ? "active" : ""
            }`}
            onClick={() => setActive("Settings")}
          >
            <Settings size={18} /> Settings
          </button>

          <div className="admin-profile">
            <div className="profile-avatar">A</div>
            <div>
              <strong>Administrator</strong>
              <small>Store owner</small>
            </div>
            <button
              className="table-action"
              title="Sign out"
              onClick={handleLogout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <button
            className="admin-mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Menu size={21} />
          </button>

          <div>
            <div className="admin-breadcrumb">PDFSHELF / WORKSPACE</div>
            <h1>{active}</h1>
          </div>

          <div className="admin-header-actions">
            <a href="/" className="view-store">
              View store <span>↗</span>
            </a>
            <button className="admin-notification" aria-label="Notifications">
              <Bell size={19} />
              <span />
            </button>
          </div>
        </header>

        <div className="admin-content">
          {pageError && (
            <div className="admin-error-message" role="alert">
              {pageError}
            </div>
          )}

          {message && (
            <div className="admin-success-message" role="status">
              {message}
            </div>
          )}

          {active === "Overview" && (
            <>
              <div className="welcome-row">
                <div>
                  <h2>Welcome back!</h2>
                  <p>Here's what's happening with your store today.</p>
                </div>

                <button className="admin-primary" onClick={openAddModal}>
                  <Plus size={17} /> Add new PDF
                </button>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-top">
                    <span>Voluntary support</span>
                    <span className="stat-icon purple">
                      <IndianRupee />
                    </span>
                  </div>
                  <h2>—</h2>
                  <div className="stat-neutral">
                    Optional contributions only
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Download activity</span>
                    <span className="stat-icon blue">
                      <ShoppingCart />
                    </span>
                  </div>
                  <h2>—</h2>
                  <div className="stat-neutral">
                    Download tracking will be added next
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Published products</span>
                    <span className="stat-icon green">
                      <Package />
                    </span>
                  </div>
                  <h2>{publishedCount}</h2>
                  <div className="stat-neutral">
                    {totalProducts} total products
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Total downloads</span>
                    <span className="stat-icon orange">
                      <Download />
                    </span>
                  </div>
                  <h2>—</h2>
                  <div className="stat-neutral">
                    Download tracking will be added next
                  </div>
                </div>
              </div>

              <div className="admin-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Recent products</h3>
                    <p>Your actual Supabase product collection</p>
                  </div>

                  <button
                    className="text-action"
                    onClick={() => setActive("Products")}
                  >
                    View all →
                  </button>
                </div>

                {loading ? (
                  <div className="admin-loading">
                    <LoaderCircle className="spin" size={22} />
                    Loading products...
                  </div>
                ) : (
                  <ProductTable
                    products={products.slice(0, 4)}
                    onEdit={openEditModal}
                    onDelete={deleteProduct}
                  />
                )}
              </div>

              <div className="admin-tip">
                <div className="tip-icon">
                  <BookOpen size={22} />
                </div>
                <div>
                  <strong>Share knowledge. Let appreciation be voluntary.</strong>
                  <p>
                    Every published PDF is free to download. Readers can optionally support your work.
                  </p>
                </div>
              </div>
            </>
          )}

          {active === "Products" && (
            <>
              <div className="welcome-row">
                <div>
                  <h2>Your products</h2>
                  <p>Manage your free digital resources and downloads.</p>
                </div>

                <button className="admin-primary" onClick={openAddModal}>
                  <Plus size={17} /> Add new PDF
                </button>
              </div>

              <div className="admin-panel">
                <div className="panel-heading">
                  <div>
                    <h3>All products</h3>
                    <p>{products.length} products in your collection</p>
                  </div>

                  <div className="admin-search">
                    <Search size={16} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search products..."
                    />
                  </div>
                </div>

                {loading ? (
                  <div className="admin-loading">
                    <LoaderCircle className="spin" size={22} />
                    Loading products...
                  </div>
                ) : (
                  <ProductTable
                    products={filtered}
                    onEdit={openEditModal}
                    onDelete={deleteProduct}
                  />
                )}
              </div>
            </>
          )}

          {active !== "Overview" && active !== "Products" && (
            <div className="admin-panel placeholder-panel">
              <div className="placeholder-icon">
                {active === "Orders" ? (
                  <ShoppingCart />
                ) : active === "Customers" ? (
                  <Users />
                ) : active === "Categories" ? (
                  <Tags />
                ) : (
                  <Settings />
                )}
              </div>

              <h2>{active} management</h2>
              <p>
                This section will be connected to your database in a later
                development phase.
              </p>

              <button
                className="admin-primary"
                onClick={() => setActive("Overview")}
              >
                Back to overview
              </button>
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div
            className="admin-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>{editingProduct ? "Edit product" : "Add a new PDF"}</h2>
                <p>
                  {editingProduct
                    ? "Update your product information and files."
                    : "Create a product listing for your store."}
                </p>
              </div>

              <button type="button" onClick={closeModal} disabled={saving}>
                <X />
              </button>
            </div>

            <form onSubmit={handleSaveProduct}>
              <label>PDF title *</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter PDF title"
                required
              />

              <label>Category</label>
              <div className="select-wrapper">
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} />
              </div>

              <label>Description</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe what customers will learn or receive..."
                rows={4}
              />

              <label>Author</label>
              <input
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                placeholder="Author name (optional)"
              />

              <label>Number of pages</label>
              <input
                type="number"
                min="1"
                step="1"
                value={pages}
                onChange={(event) => setPages(event.target.value)}
                placeholder="Optional"
              />

              <label>Language</label>
              <input
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                placeholder="English"
              />

              <label>PDF document {editingProduct ? "" : "*"}</label>
              <div className="upload-placeholder">
                <Upload size={23} />
                <strong>
                  {pdfFile
                    ? pdfFile.name
                    : editingProduct?.file_path
                      ? "Existing PDF is uploaded"
                      : "Choose a PDF document"}
                </strong>
                <small>
                  {editingProduct
                    ? "Select a new PDF only if you want to replace the existing file."
                    : "PDF format required. Maximum size is determined by your storage bucket limit."}
                </small>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(event) =>
                    setPdfFile(event.target.files?.[0] || null)
                  }
                  required={!editingProduct}
                />
              </div>

              <label>Cover image</label>
              <div className="upload-placeholder">
                <Upload size={23} />
                <strong>
                  {coverFile
                    ? coverFile.name
                    : editingProduct?.cover_image_url
                      ? "Existing cover image is uploaded"
                      : "Choose a cover image"}
                </strong>
                <small>JPG, PNG or WebP image formats.</small>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setCoverFile(event.target.files?.[0] || null)
                  }
                />
              </div>

              <label>Product status</label>
              <div className="select-wrapper">
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as "draft" | "published")
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
                <ChevronDown size={16} />
              </div>

              {pageError && (
                <div className="admin-error-message" role="alert">
                  {pageError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  className="admin-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <LoaderCircle className="spin" size={17} />
                      Saving...
                    </>
                  ) : editingProduct ? (
                    "Save changes"
                  ) : (
                    "Save product"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductTable({
  products,
  onEdit,
  onDelete,
}: {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>PRODUCT</th>
            <th>CATEGORY</th>
            <th>ACCESS</th>
            <th>FILE</th>
            <th>STATUS</th>
            <th>ACTIONS</th>
          </tr>
        </thead>

        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>
                <div className="table-product">
                  {product.cover_image_url ? (
                    <img
                      src={product.cover_image_url}
                      alt=""
                      className="table-product-icon"
                    />
                  ) : (
                    <div className="table-product-icon">
                      <FileText size={18} />
                    </div>
                  )}
                  <strong>{product.title}</strong>
                </div>
              </td>

              <td>{product.categoryName || "Uncategorised"}</td>
              <td><span className="status-pill published">Free download</span></td>
              <td>{formatFileSize(product.file_size)}</td>

              <td>
                <span
                  className={`status-pill ${
                    product.status === "published"
                      ? "published"
                      : "draft"
                  }`}
                >
                  {product.status.charAt(0).toUpperCase() +
                    product.status.slice(1)}
                </span>
              </td>

              <td>
                <div className="product-actions">
                  <button
                    className="table-action"
                    onClick={() => onEdit(product)}
                    title="Edit product"
                  >
                    <Pencil size={17} />
                  </button>

                  <button
                    className="table-action"
                    onClick={() => onDelete(product)}
                    title="Delete product"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {products.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-table">
                No products found. Add your first PDF product.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Admin;