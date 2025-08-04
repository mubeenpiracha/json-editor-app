document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const saveBtn = document.getElementById('save-btn');
    const copyBtn = document.getElementById('copy-btn');
    const jsonEditor = document.getElementById('json-editor');
    const modal = document.getElementById('add-modal');
    const modalHeader = document.getElementById('modal-header');
    const modalFormContent = document.getElementById('modal-form-content');

    let currentData = null;
    let currentFileName = 'edited.json';

    const renderJSON = (data, parentElement) => {
        parentElement.innerHTML = '';
        if (typeof data === 'object' && data !== null) {
            parentElement.appendChild(createObjectBox(data, 'Root', 0, () => {}));
        } else {
            parentElement.textContent = 'JSON data is not a valid object or array.';
        }
    };

    const createObjectBox = (data, key, level, deleteCallback) => {
        const box = document.createElement('div');
        box.className = 'object-box';
        const header = document.createElement('div');
        header.className = 'object-header';
        const title = document.createElement('span');
        title.className = `object-title level-${level}`;
        title.textContent = key;
        header.appendChild(title);
        const actions = document.createElement('div');
        actions.className = 'action-buttons';
        const addButton = createButton(Array.isArray(data) ? 'Add Item' : 'Add Field', 'add-btn', () => {
            if (Array.isArray(data)) addItem(data);
            else addField(data);
        });
        actions.appendChild(addButton);
        if (level > 0) {
            actions.appendChild(createButton('Delete', 'delete-btn', deleteCallback));
        }
        header.appendChild(actions);
        box.appendChild(header);
        const content = document.createElement('div');
        content.className = 'object-content';
        renderNodeContent(data, content, level + 1);
        box.appendChild(content);
        return box;
    };

    const renderNodeContent = (data, parentElement, level) => {
        parentElement.innerHTML = '';
        const schema = getObjectSchema(data);
        if (schema && schema.length > 3) {
            parentElement.appendChild(renderArrayAsTable(Object.values(data), schema, Object.keys(data)));
            return;
        }

        const propertyGrid = document.createElement('div');
        propertyGrid.className = 'property-grid';
        const nestedObjects = [];

        const processEntry = (value, key) => {
            if (typeof value === 'object' && value !== null) {
                nestedObjects.push({ key, value });
            } else {
                renderPrimitive(key, value, data, propertyGrid);
            }
        };

        if (Array.isArray(data)) {
            data.forEach((item, index) => processEntry(item, index));
        } else {
            Object.keys(data).forEach(key => processEntry(data[key], key));
        }

        if (propertyGrid.hasChildNodes()) {
            parentElement.appendChild(propertyGrid);
        }
        nestedObjects.forEach(({ key, value }) => {
            parentElement.appendChild(createObjectBox(value, key, level, () => deleteProperty(data, key)));
        });
    };

    const renderArrayAsTable = (dataArray, schema, keys) => {
        const table = document.createElement('table');
        table.className = 'horizontal-table';
        const thead = table.createTHead().insertRow();
        if (keys) { // It's an object being displayed as a table
            thead.appendChild(document.createElement('th')).textContent = 'Key';
        }
        schema.forEach(key => thead.appendChild(document.createElement('th')).textContent = key);
        thead.appendChild(document.createElement('th')).textContent = 'Actions';

        const tbody = table.createTBody();
        dataArray.forEach((item, index) => {
            const row = tbody.insertRow();
            if (keys) {
                row.insertCell().textContent = keys[index];
            }
            schema.forEach(key => {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = item[key] !== undefined ? item[key] : '';
                input.onchange = () => updateValue(item, key, input.value);
                row.insertCell().appendChild(input);
            });
            const actionsCell = row.insertCell();
            actionsCell.appendChild(createButton('Delete', 'delete-btn', () => {
                const originalKey = keys ? keys[index] : index;
                deleteProperty(keys ? dataArray[0] : dataArray, originalKey);
            }));
        });
        return table;
    };

    const renderPrimitive = (key, value, parentObject, grid) => {
        const keyDiv = document.createElement('div');
        keyDiv.className = 'property-key';
        keyDiv.textContent = key;
        const valueDiv = document.createElement('div');
        valueDiv.className = 'property-value';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value;
        input.onchange = () => updateValue(parentObject, key, input.value);
        valueDiv.appendChild(input);
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'property-actions';
        actionsDiv.appendChild(createButton('Delete', 'delete-btn', () => deleteProperty(parentObject, key)));
        grid.appendChild(keyDiv);
        grid.appendChild(valueDiv);
        grid.appendChild(actionsDiv);
    };

    const isFlatObject = (obj) => obj !== null && typeof obj === 'object' && !Array.isArray(obj) && Object.values(obj).every(val => typeof val !== 'object' || val === null);

    const getObjectSchema = (obj) => {
        if (Array.isArray(obj)) return getArraySchema(obj);
        if (!obj || typeof obj !== 'object') return null;
        const values = Object.values(obj);
        if (values.length === 0) return null;
        return getArraySchema(values);
    };

    const getArraySchema = (arr) => {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        const first = arr[0];
        if (!isFlatObject(first)) return null;
        const firstKeys = Object.keys(first);
        if (firstKeys.length === 0) return null;
        for (let i = 1; i < arr.length; i++) {
            const current = arr[i];
            if (!isFlatObject(current)) return null;
            const currentKeys = Object.keys(current);
            if (currentKeys.length !== firstKeys.length || currentKeys.some((k, j) => k !== firstKeys[j])) {
                return null;
            }
        }
        return firstKeys;
    };

    const showModal = (title, fields, callback) => {
        modalHeader.textContent = title;
        modalFormContent.innerHTML = '';
        const formGrid = document.createElement('div');
        formGrid.className = 'modal-form-grid';
        const inputs = {};

        fields.forEach(field => {
            const label = document.createElement('label');
            label.htmlFor = `modal-field-${field.name}`;
            label.textContent = field.label;
            const input = document.createElement('input');
            input.type = field.type || 'text';
            input.id = `modal-field-${field.name}`;
            input.name = field.name;
            input.value = field.defaultValue || '';
            formGrid.appendChild(label);
            formGrid.appendChild(input);
            inputs[field.name] = input;
        });

        modalFormContent.appendChild(formGrid);

        const actions = document.createElement('div');
        actions.className = 'modal-actions';
        const saveButton = createButton('Save', 'add-btn', () => {
            const result = {};
            for (const name in inputs) {
                result[name] = inputs[name].value;
            }
            callback(result);
            hideModal();
        });
        const cancelButton = createButton('Cancel', 'cancel-btn', hideModal);
        actions.appendChild(cancelButton);
        actions.appendChild(saveButton);
        modalFormContent.appendChild(actions);

        modal.style.display = 'flex';
    };

    const hideModal = () => {
        modal.style.display = 'none';
    };

    const addField = (obj) => {
        const schema = getObjectSchema(obj);
        if (schema) {
            const fields = [{ name: '__new_key__', label: 'Key' }, ...schema.map(key => ({ name: key, label: key }))];
            showModal('Add New Field', fields, (result) => {
                const newKey = result['__new_key__'];
                if (newKey && !obj.hasOwnProperty(newKey)) {
                    const newItem = {};
                    for (const key in result) {
                        if (key !== '__new_key__') {
                            newItem[key] = parseValue(result[key]);
                        }
                    }
                    obj[newKey] = newItem;
                    renderJSON(currentData, jsonEditor);
                } else if (newKey) {
                    alert(`Key "${newKey}" already exists.`);
                }
            });
        } else {
            const fields = [
                { name: 'key', label: 'Key' },
                { name: 'value', label: 'Value', defaultValue: 'null' }
            ];
            showModal('Add New Field', fields, (result) => {
                if (result.key && !obj.hasOwnProperty(result.key)) {
                    obj[result.key] = parseValue(result.value);
                    renderJSON(currentData, jsonEditor);
                } else if (result.key) {
                    alert(`Key "${result.key}" already exists.`);
                }
            });
        }
    };

    const generateFormFields = (obj, prefix = '') => {
        const fields = [];
        for (const key in obj) {
            const value = obj[key];
            const newPrefix = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                fields.push(...generateFormFields(value, newPrefix));
            } else {
                fields.push({ name: newPrefix, label: newPrefix, defaultValue: value });
            }
        }
        return fields;
    };

    const unflatten = (obj) => {
        const result = {};
        for (const key in obj) {
            const keys = key.split('.');
            keys.reduce((acc, part, i) => {
                if (i === keys.length - 1) {
                    acc[part] = parseValue(obj[key]);
                } else {
                    acc[part] = acc[part] || (Number.isInteger(Number(keys[i+1])) ? [] : {});
                }
                return acc[part];
            }, result);
        }
        return result;
    };

    const addItem = (arr) => {
        if (arr.length > 0 && Array.isArray(arr[0])) {
            const template = arr[0];
            const fields = template.map((_, index) => ({ name: `value-${index}`, label: `Value ${index}` }));
            showModal('Add New Array Item', fields, (result) => {
                const newItem = [];
                for (const key in result) {
                    newItem.push(parseValue(result[key]));
                }
                arr.push(newItem);
                renderJSON(currentData, jsonEditor);
            });
            return;
        }

        const schema = getArraySchema(arr);
        if (schema) {
            const fields = schema.map(key => ({ name: key, label: key, defaultValue: '' }));
            showModal('Add New Item', fields, (result) => {
                const newItem = {};
                for (const key in result) {
                    newItem[key] = parseValue(result[key]);
                }
                arr.push(newItem);
                renderJSON(currentData, jsonEditor);
            });
        } else if (arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
            const template = arr[0];
            const fields = generateFormFields(template);
            showModal('Add New Item', fields, (result) => {
                const newItem = unflatten(result);
                arr.push(newItem);
                renderJSON(currentData, jsonEditor);
            });
        } else {
            const fields = [{ name: 'value', label: 'Value', defaultValue: 'null' }];
            showModal('Add New Item', fields, (result) => {
                arr.push(parseValue(result.value));
                renderJSON(currentData, jsonEditor);
            });
        }
    };

    const parseValue = (str) => {
        if (str.toLowerCase() === 'true') return true;
        if (str.toLowerCase() === 'false') return false;
        if (str.trim() !== '' && !isNaN(Number(str)) && !str.startsWith('0x')) return Number(str);
        try {
            return JSON.parse(str);
        } catch (e) {
            return str;
        }
    };

    const createButton = (text, className, onClick) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = className;
        button.onclick = (e) => {
            e.stopPropagation();
            onClick();
        };
        return button;
    };

    const updateValue = (obj, key, newValueStr) => {
        const originalValue = obj[key];
        obj[key] = parseValue(newValueStr);
    };

    const deleteProperty = (parent, key) => {
        if (confirm(`Are you sure you want to delete '${key}'?`)) {
            if (Array.isArray(parent)) {
                parent.splice(Number(key), 1);
            } else {
                delete parent[key];
            }
            renderJSON(currentData, jsonEditor);
        }
    };

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            currentFileName = file.name;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    currentData = JSON.parse(e.target.result);
                    renderJSON(currentData, jsonEditor);
                } catch (error) { alert(`Error parsing JSON file: ${error.message}`); }
            };
            reader.readAsText(file);
        }
    });

    saveBtn.addEventListener('click', () => {
        if (!currentData) return alert('No data to save.');
        const jsonData = JSON.stringify(currentData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = currentFileName;
        a.click();
        URL.revokeObjectURL(a.href);
    });

    copyBtn.addEventListener('click', () => {
        if (!currentData) return alert('No data to copy.');
        const jsonData = JSON.stringify(currentData, null, 2);
        navigator.clipboard.writeText(jsonData).then(() => alert('JSON copied!'), () => alert('Copy failed.'));
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal();
        }
    });
});