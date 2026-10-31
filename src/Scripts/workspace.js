const STORAGE_KEY = 'techpulse.resources.v1';
const POSTS_API_URL = 'https://dummyjson.com/posts?limit=6';

const resourceForm = document.getElementById('resource-form');
const resourceName = document.getElementById('resource-name');
const resourceCategory = document.getElementById('resource-category');
const resourceNotes = document.getElementById('resource-notes');
const resourceList = document.getElementById('resource-list');
const emptyState = document.getElementById('empty-state');
const recordCount = document.getElementById('record-count');
const searchInput = document.getElementById('resource-search');
const categoryFilter = document.getElementById('category-filter');
const formTitle = document.getElementById('form-title');
const saveResourceButton = document.getElementById('save-resource-btn');
const cancelEditButton = document.getElementById('cancel-edit-btn');
const formStatus = document.getElementById('form-status');
const storageStatus = document.getElementById('storage-status');
const apiStatus = document.getElementById('api-status');
const apiError = document.getElementById('api-error');
const apiPosts = document.getElementById('api-posts');
const reloadPostsButton = document.getElementById('reload-posts-btn');

let records = loadRecords();
let editingId = null;

function isResource(record) {
  return record !== null
    && typeof record === 'object'
    && typeof record.id === 'string'
    && typeof record.name === 'string'
    && typeof record.category === 'string'
    && typeof record.notes === 'string'
    && typeof record.createdAt === 'string';
}

function loadRecords() {
  try {
    const savedRecords = localStorage.getItem(STORAGE_KEY);
    if (savedRecords === null) {
      return [];
    }

    const parsedRecords = JSON.parse(savedRecords);
    if (!Array.isArray(parsedRecords) || !parsedRecords.every(isResource)) {
      throw new Error('The saved resource data has an invalid format.');
    }
    return parsedRecords;
  } catch (error) {
    storageStatus.textContent = `Saved resources could not be loaded: ${error.message}`;
    storageStatus.className = 'mb-4 p-3 rounded-lg text-sm border border-red-200 bg-red-50 text-red-800';
    return [];
  }
}

function persistRecords() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    storageStatus.textContent = 'Your resource changes are saved in this browser.';
    storageStatus.className = 'mb-4 p-3 rounded-lg text-sm border border-green-200 bg-green-50 text-green-800';
    return true;
  } catch (error) {
    storageStatus.textContent = `Your changes are only available for this session because Local Storage could not save them: ${error.message}`;
    storageStatus.className = 'mb-4 p-3 rounded-lg text-sm border border-red-200 bg-red-50 text-red-800';
    return false;
  }
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function createResourceCard(record) {
  const card = createElement('article', 'bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col');
  const category = createElement('span', 'self-start px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold', record.category);
  const title = createElement('h3', 'mt-3 text-lg font-bold text-gray-900 break-words', record.name);
  const notes = createElement('p', 'mt-2 text-sm text-gray-600 whitespace-pre-wrap break-words flex-grow', record.notes);
  const date = new Date(record.createdAt);
  const timestamp = createElement('p', 'mt-4 text-xs text-gray-400', `Added ${Number.isNaN(date.getTime()) ? 'recently' : date.toLocaleDateString()}`);
  const actions = createElement('div', 'mt-4 pt-4 border-t border-gray-100 flex gap-2');
  const editButton = createElement('button', 'flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50');
  editButton.type = 'button';
  editButton.textContent = 'Edit';
  editButton.dataset.action = 'edit';
  editButton.dataset.id = record.id;
  editButton.setAttribute('aria-label', `Edit ${record.name}`);

  const deleteButton = createElement('button', 'flex-1 px-3 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-700 hover:bg-red-50');
  deleteButton.type = 'button';
  deleteButton.textContent = 'Delete';
  deleteButton.dataset.action = 'delete';
  deleteButton.dataset.id = record.id;
  deleteButton.setAttribute('aria-label', `Delete ${record.name}`);

  actions.append(editButton, deleteButton);
  card.append(category, title, notes, timestamp, actions);
  return card;
}

function renderResources() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const selectedCategory = categoryFilter.value;
  const matchingRecords = records.filter((record) => {
    const matchesText = [record.name, record.category, record.notes]
      .some((value) => value.toLocaleLowerCase().includes(query));
    const matchesCategory = selectedCategory === '' || record.category === selectedCategory;
    return matchesText && matchesCategory;
  });

  resourceList.replaceChildren(...matchingRecords.map(createResourceCard));
  emptyState.classList.toggle('hidden', matchingRecords.length > 0);
  recordCount.textContent = `${records.length} ${records.length === 1 ? 'resource' : 'resources'} saved`;
}

function setFormStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.className = `text-sm ${isError ? 'text-red-700' : 'text-green-700'}`;
}

function resetForm() {
  resourceForm.reset();
  editingId = null;
  formTitle.textContent = 'Add a resource';
  saveResourceButton.textContent = 'Add resource';
  cancelEditButton.classList.add('hidden');
}

function createUniqueId() {
  let id;
  do {
    id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  } while (records.some((record) => record.id === id));
  return id;
}

resourceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const values = [resourceName.value.trim(), resourceCategory.value, resourceNotes.value.trim()];
  if (!values.every((value) => value.length > 0)) {
    setFormStatus('Please complete every field before saving.', true);
    return;
  }

  const [name, category, notes] = values;
  if (editingId !== null) {
    const existingRecord = records.find((record) => record.id === editingId);
    if (!existingRecord) {
      setFormStatus('This resource is no longer available to edit. Refresh the list and try again.', true);
      resetForm();
      return;
    }
    records = records.map((record) => record.id === editingId
      ? { ...record, name, category, notes }
      : record);
  } else {
    records.unshift({
      id: createUniqueId(),
      name,
      category,
      notes,
      createdAt: new Date().toISOString()
    });
  }

  const wasEditing = editingId !== null;
  resetForm();
  renderResources();
  const saved = persistRecords();
  if (saved) {
    setFormStatus(wasEditing ? 'Resource updated.' : 'Resource added.');
  }
});

resourceList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || !resourceList.contains(button)) {
    return;
  }

  const record = records.find((item) => item.id === button.dataset.id);
  if (!record) {
    setFormStatus('That resource could not be found. The list may have changed.', true);
    return;
  }

  if (button.dataset.action === 'edit') {
    editingId = record.id;
    resourceName.value = record.name;
    resourceCategory.value = record.category;
    resourceNotes.value = record.notes;
    formTitle.textContent = 'Edit resource';
    saveResourceButton.textContent = 'Save changes';
    cancelEditButton.classList.remove('hidden');
    setFormStatus(`Editing “${record.name}”.`);
    resourceName.focus();
    return;
  }

  if (button.dataset.action === 'delete' && window.confirm(`Delete “${record.name}”? This cannot be undone.`)) {
    records = records.filter((item) => item.id !== record.id);
    if (editingId === record.id) {
      resetForm();
    }
    renderResources();
    const saved = persistRecords();
    if (saved) {
      setFormStatus('Resource deleted.');
    }
  }
});

cancelEditButton.addEventListener('click', () => {
  resetForm();
  setFormStatus('Editing canceled.');
});

searchInput.addEventListener('input', renderResources);
categoryFilter.addEventListener('change', renderResources);

async function loadApiPosts() {
  apiPosts.replaceChildren();
  apiError.classList.add('hidden');
  apiStatus.textContent = 'Loading sample posts…';
  reloadPostsButton.disabled = true;
  reloadPostsButton.textContent = 'Loading…';

  try {
    if (typeof axios === 'undefined') {
      throw new Error('Axios did not load. Check your internet connection and reload the page.');
    }
    const response = await axios.get(POSTS_API_URL, { timeout: 10000 });
    const posts = response.data && response.data.posts;
    if (!Array.isArray(posts)) {
      throw new Error('The posts API returned data in an unexpected format.');
    }

    const postCards = posts.map((post) => {
      const card = createElement('article', 'p-5 rounded-xl border border-gray-200 bg-gray-50');
      const label = createElement('p', 'text-xs font-semibold uppercase tracking-wide text-indigo-600', `Sample post #${post.id}`);
      const title = createElement('h3', 'mt-2 font-bold text-gray-900 break-words', String(post.title || 'Untitled post'));
      const body = createElement('p', 'mt-2 text-sm text-gray-600 break-words', String(post.body || 'No description available.'));
      card.append(label, title, body);
      return card;
    });
    apiPosts.replaceChildren(...postCards);
    apiStatus.textContent = `Loaded ${posts.length} sample ${posts.length === 1 ? 'post' : 'posts'} from DummyJSON.`;
  } catch (error) {
    const detail = error.response
      ? `The API responded with status ${error.response.status}.`
      : error.message;
    apiStatus.textContent = 'Sample posts could not be loaded.';
    apiError.textContent = `${detail} Check your connection and try again.`;
    apiError.classList.remove('hidden');
  } finally {
    reloadPostsButton.disabled = false;
    reloadPostsButton.textContent = 'Reload posts';
  }
}

reloadPostsButton.addEventListener('click', loadApiPosts);

const mobileMenuButton = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const openMenuIcon = document.getElementById('menu-icon-open');
const closeMenuIcon = document.getElementById('menu-icon-close');
mobileMenuButton.addEventListener('click', () => {
  const isOpening = mobileMenu.classList.toggle('hidden') === false;
  mobileMenuButton.setAttribute('aria-expanded', String(isOpening));
  openMenuIcon.classList.toggle('hidden', isOpening);
  closeMenuIcon.classList.toggle('hidden', !isOpening);
});

renderResources();
loadApiPosts();
