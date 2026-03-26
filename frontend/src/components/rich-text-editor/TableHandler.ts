import { TableResizeHandler } from './TableResizeHandler';
import { TableMenuHandler } from './TableMenuHandler';

// Khai báo interface để mở rộng HTMLTableElement
interface ExtendedHTMLTableElement extends HTMLTableElement {
  menuButton?: HTMLElement;
}

/**
 * TableHandler - Xử lý chức năng bảng trong rich text editor
 */
export class TableHandler {
  editor: HTMLElement;
  currentTable: HTMLTableElement | null = null;
  currentTableCell: HTMLTableCellElement | null = null;
  tableMenu: HTMLElement | null = null;
  resizeHandler: any = null;
  menuHandler: any = null;
  selectedCells: HTMLTableCellElement[] = [];
  isSelecting: boolean = false;
  selectionStartCell: HTMLTableCellElement | null = null;
  selectionEndCell: HTMLTableCellElement | null = null;

  constructor(editor: HTMLElement) {
    this.editor = editor;
    this.initTableHandlers();
    this.initTableMenu();
  }

  initTableHandlers() {
    // Lắng nghe sự kiện click trong editor để xác định bảng và ô được chọn
    this.editor.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      // Kiểm tra xem có click vào bảng không
      const tableElement = target.closest('table');
      if (tableElement) {
        this.setCurrentTable(tableElement as HTMLTableElement);
      } else {
        this.clearCurrentTable();
      }
      
      // Kiểm tra xem có click vào ô của bảng không
      const cellElement = target.closest('td, th');
      if (cellElement) {
        this.setCurrentTableCell(cellElement as HTMLTableCellElement);
      } else {
        this.clearCurrentTableCell();
      }
    });
    
    // Lắng nghe sự kiện mousedown trong editor để bắt đầu quá trình chọn nhiều ô
    this.editor.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      const cellElement = target.closest('td, th');
      
      if (cellElement && e.button === 0) { // Chỉ xử lý click chuột trái
        this.startCellSelection(cellElement as HTMLTableCellElement);
      }
    });
    
    // Lắng nghe sự kiện mousemove trong editor để mở rộng vùng chọn
    this.editor.addEventListener('mousemove', (e) => {
      if (this.isSelecting) {
        const target = e.target as HTMLElement;
        const cellElement = target.closest('td, th');
        
        if (cellElement) {
          this.updateCellSelection(cellElement as HTMLTableCellElement);
        }
      }
    });
    
    // Lắng nghe sự kiện mouseup để kết thúc quá trình chọn
    document.addEventListener('mouseup', () => {
      if (this.isSelecting) {
        this.endCellSelection();
      }
    });
  }

  initTableMenu() {
    // Tìm menu cho bảng nếu đã được tạo
    this.tableMenu = document.getElementById('table-menu');
    
    if (!this.tableMenu) {
      this.tableMenu = document.createElement('div');
      this.tableMenu.id = 'table-menu';
      this.tableMenu.className = 'context-menu';
      document.body.appendChild(this.tableMenu);
    }
    
    // Tạo các nút cho menu
    const menuItems = [
      { label: 'Thêm hàng phía trên', action: () => this.insertRow('above') },
      { label: 'Thêm hàng phía dưới', action: () => this.insertRow('below') },
      { label: 'Thêm cột bên trái', action: () => this.insertColumn('left') },
      { label: 'Thêm cột bên phải', action: () => this.insertColumn('right') },
      { label: 'Xóa hàng', action: () => this.deleteRow() },
      { label: 'Xóa cột', action: () => this.deleteColumn() },
      { label: 'Gộp ô', action: () => this.mergeCells() },
      { label: 'Tách ô', action: () => this.splitCell() },
      { label: 'Xóa bảng', action: () => this.deleteTable() }
    ];
    
    // Xóa tất cả menu items cũ
    this.tableMenu.innerHTML = '';
    
    // Thêm các menu items mới
    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = 'context-menu-item';
      menuItem.textContent = item.label;
      menuItem.addEventListener('click', () => {
        item.action();
        this.hideTableMenu();
      });
      this.tableMenu.appendChild(menuItem);
    });
    
    // Ẩn menu khi click ra ngoài
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.context-menu') && !target.closest('.table-menu-btn')) {
        this.hideTableMenu();
      }
    });
  }

  setCurrentTable(table: HTMLTableElement) {
    if (this.currentTable !== table) {
      // Bỏ chọn bảng cũ nếu có
      if (this.currentTable) {
        this.currentTable.classList.remove('focused');
      }
      
      // Đặt bảng hiện tại và thêm class focused
      this.currentTable = table;
      this.currentTable.classList.add('focused');
      
      // Cập nhật nút điều khiển bảng
      this.updateTableControls();
    }
  }

  clearCurrentTable() {
    if (this.currentTable) {
      this.currentTable.classList.remove('focused');
      this.currentTable = null;
      
      // Ẩn các nút điều khiển bảng
      this.hideTableControls();
    }
  }

  setCurrentTableCell(cell: HTMLTableCellElement) {
    this.currentTableCell = cell;
  }

  clearCurrentTableCell() {
    this.currentTableCell = null;
    this.clearSelectedCells();
  }

  updateTableControls() {
    if (!this.currentTable) return;
    
    // Nếu bảng nằm trong container riêng, thêm các nút điều khiển
    let tableContainer = this.currentTable.closest('.table-container');
    
    // Nếu bảng chưa có container, tạo container mới
    if (!tableContainer) {
      tableContainer = document.createElement('div');
      tableContainer.className = 'table-container';
      this.currentTable.parentNode?.insertBefore(tableContainer, this.currentTable);
      tableContainer.appendChild(this.currentTable);
    }
    
    // Kiểm tra và tạo nút menu nếu chưa có
    let menuButton = tableContainer.querySelector('.table-menu-btn');
    if (!menuButton) {
      menuButton = document.createElement('button');
      menuButton.className = 'table-menu-btn';
      menuButton.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
      menuButton.title = 'Tùy chọn bảng';
      tableContainer.appendChild(menuButton);
      
      // Thêm sự kiện cho nút menu
      menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showTableMenu(e);
      });
    }
    
    // Khởi tạo handler cho việc resize cột
    this.initColumnResizeHandlers();
  }

  hideTableControls() {
    this.hideTableMenu();
    this.removeColumnResizeHandlers();
  }

  showTableMenu(e: MouseEvent) {
    if (!this.tableMenu || !this.currentTable) return;
    
    // Hiển thị menu và đặt vị trí
    this.tableMenu.style.display = 'block';
    
    // Tính toán vị trí để hiển thị menu phù hợp
    const buttonRect = (e.target as HTMLElement).getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    
    this.tableMenu.style.top = (buttonRect.bottom + scrollY) + 'px';
    this.tableMenu.style.left = buttonRect.left + 'px';
    
    // Kiểm tra nếu menu bị tràn ra khỏi viewport
    setTimeout(() => {
      const menuRect = this.tableMenu?.getBoundingClientRect();
      if (menuRect) {
        if (menuRect.right > window.innerWidth) {
          this.tableMenu!.style.left = (buttonRect.right - menuRect.width) + 'px';
        }
        
        if (menuRect.bottom > window.innerHeight) {
          this.tableMenu!.style.top = (buttonRect.top + scrollY - menuRect.height) + 'px';
        }
      }
    }, 0);
  }

  hideTableMenu() {
    if (this.tableMenu) {
      this.tableMenu.style.display = 'none';
    }
  }

  initColumnResizeHandlers() {
    if (!this.currentTable) return;
    
    // Xóa handlers cũ nếu có
    this.removeColumnResizeHandlers();
    
    // Lấy tất cả ô trong hàng đầu tiên
    const firstRow = this.currentTable.rows[0];
    if (!firstRow) return;
    
    const cells = firstRow.cells;
    
    // Thêm handle resize cho mỗi cột
    for (let i = 0; i < cells.length - 1; i++) { // Không thêm cho cột cuối
      const cell = cells[i];
      const handle = document.createElement('div');
      handle.className = 'col-resize-handle';
      handle.dataset.columnIndex = i.toString();
      
      // Điều chỉnh chiều cao của handle bằng với chiều cao của bảng
      handle.style.height = this.currentTable.offsetHeight + 'px';
      
      cell.style.position = 'relative';
      cell.appendChild(handle);
      
      // Thêm sự kiện cho handle
      handle.addEventListener('mousedown', this.startColumnResize.bind(this));
    }
  }

  removeColumnResizeHandlers() {
    const handles = this.editor.querySelectorAll('.col-resize-handle');
    handles.forEach(handle => handle.remove());
    
    // Xóa bất kỳ resizer đang hiển thị
    const resizer = document.querySelector('.table-column-resizer');
    if (resizer) {
      resizer.remove();
    }
  }

  startColumnResize(e: MouseEvent) {
    if (!this.currentTable) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const handle = e.target as HTMLElement;
    const columnIndex = parseInt(handle.dataset.columnIndex || '0');
    
    // Thêm class để thay đổi cursor
    this.currentTable.classList.add('resizing-column');
    handle.classList.add('active');
    
    // Tạo và hiển thị resizer line
    const resizer = document.createElement('div');
    resizer.className = 'table-column-resizer';
    document.body.appendChild(resizer);
    
    // Lấy vị trí của cột đang resize
    const cell = this.currentTable.rows[0].cells[columnIndex];
    const cellRect = cell.getBoundingClientRect();
    
    // Đặt vị trí ban đầu cho resizer
    resizer.style.height = this.currentTable.offsetHeight + 'px';
    resizer.style.top = cellRect.top + 'px';
    resizer.style.left = (e.clientX) + 'px';
    resizer.style.display = 'block';
    
    // Lưu lại thông tin ban đầu
    const initialX = e.clientX;
    const initialWidth = cell.offsetWidth;
    
    // Hàm xử lý sự kiện mousemove
    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      
      // Tính toán sự thay đổi chiều rộng
      const deltaX = moveEvent.clientX - initialX;
      
      // Cập nhật vị trí của resizer
      resizer.style.left = (moveEvent.clientX) + 'px';
      
      // Tính toán chiều rộng mới (đảm bảo không nhỏ hơn giá trị tối thiểu)
      const newWidth = Math.max(30, initialWidth + deltaX);
      
      // Lưu lại giá trị mới để áp dụng khi kết thúc resize
      resizer.dataset.newWidth = newWidth.toString();
    };
    
    // Hàm xử lý sự kiện mouseup
    const handleMouseUp = () => {
      // Xóa class
      this.currentTable?.classList.remove('resizing-column');
      handle.classList.remove('active');
      
      // Áp dụng chiều rộng mới cho tất cả các ô trong cột
      if (resizer.dataset.newWidth && this.currentTable) {
        const newWidth = parseInt(resizer.dataset.newWidth);
        
        // Áp dụng chiều rộng mới cho tất cả các ô trong cột
        for (let i = 0; i < this.currentTable.rows.length; i++) {
          const cell = this.currentTable.rows[i].cells[columnIndex];
          if (cell) {
            cell.style.width = newWidth + 'px';
          }
        }
      }
      
      // Xóa resizer
      resizer.remove();
      
      // Xóa các event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    // Thêm các event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  startCellSelection(cell: HTMLTableCellElement) {
    // Xóa các ô đã chọn trước đó
    this.clearSelectedCells();
    
    // Đánh dấu trạng thái bắt đầu chọn
    this.isSelecting = true;
    this.selectionStartCell = cell;
    
    // Thêm class selected cho ô đầu tiên
    cell.classList.add('selected-cell');
    this.selectedCells.push(cell);
  }

  updateCellSelection(cell: HTMLTableCellElement) {
    if (!this.isSelecting || !this.selectionStartCell || !this.currentTable) return;
    
    // Cập nhật ô kết thúc
    this.selectionEndCell = cell;
    
    // Xóa class selected từ tất cả các ô
    this.clearSelectedCells();
    
    // Xác định vùng được chọn
    const startRowIndex = this.getRowIndex(this.selectionStartCell);
    const startColIndex = this.getColumnIndex(this.selectionStartCell);
    const endRowIndex = this.getRowIndex(cell);
    const endColIndex = this.getColumnIndex(cell);
    
    // Tính toán phạm vi của hàng và cột được chọn
    const rowStart = Math.min(startRowIndex, endRowIndex);
    const rowEnd = Math.max(startRowIndex, endRowIndex);
    const colStart = Math.min(startColIndex, endColIndex);
    const colEnd = Math.max(startColIndex, endColIndex);
    
    // Thêm class selected cho tất cả các ô trong vùng chọn
    for (let i = rowStart; i <= rowEnd; i++) {
      const row = this.currentTable.rows[i];
      if (row) {
        for (let j = colStart; j <= colEnd; j++) {
          const cell = row.cells[j];
          if (cell) {
            cell.classList.add('selected-cell');
            this.selectedCells.push(cell);
          }
        }
      }
    }
  }

  endCellSelection() {
    this.isSelecting = false;
  }

  clearSelectedCells() {
    this.selectedCells.forEach(cell => cell.classList.remove('selected-cell'));
    this.selectedCells = [];
  }

  getRowIndex(cell: HTMLTableCellElement): number {
    const row = cell.parentElement;
    if (!row) return -1;
    
    // Tìm tất cả các hàng trong bảng
    const rows = Array.from(row.parentElement?.children || []);
    return rows.indexOf(row);
  }

  getColumnIndex(cell: HTMLTableCellElement): number {
    const row = cell.parentElement;
    if (!row) return -1;
    
    // Tìm tất cả các ô trong hàng
    const cells = Array.from(row.children);
    return cells.indexOf(cell);
  }

  insertTable(rows: number, cols: number, hasHeaderRow: boolean = false, hasHeaderColumn: boolean = false) {
    // Tạo bảng mới
    const table = document.createElement('table');
    
    // Thêm các hàng và cột
    for (let i = 0; i < rows; i++) {
      const row = document.createElement('tr');
      
      for (let j = 0; j < cols; j++) {
        // Quyết định tạo th hay td
        const isHeader = (hasHeaderRow && i === 0) || (hasHeaderColumn && j === 0);
        const cell = document.createElement(isHeader ? 'th' : 'td');
        
        // Nếu là ô đầu tiên, thêm focus để có thể bắt đầu chỉnh sửa
        if (i === 0 && j === 0) {
          cell.innerHTML = '<br>';
        } else {
          cell.innerHTML = '&nbsp;';
        }
        
        row.appendChild(cell);
      }
      
      table.appendChild(row);
    }
    
    // Thêm bảng vào editor
    // Sử dụng selection API để chèn vào vị trí hiện tại
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // Tạo container cho bảng để có thể thêm các nút điều khiển
      const tableContainer = document.createElement('div');
      tableContainer.className = 'table-container';
      tableContainer.appendChild(table);
      
      // Chèn container vào vị trí của selection
      range.deleteContents();
      range.insertNode(tableContainer);
      
      // Di chuyển caret đến ô đầu tiên
      const firstCell = table.rows[0].cells[0];
      const newRange = document.createRange();
      newRange.selectNodeContents(firstCell);
      newRange.collapse(true);
      
      selection.removeAllRanges();
      selection.addRange(newRange);
      
      // Đặt bảng này là bảng hiện tại
      this.setCurrentTable(table);
    }
  }

  insertRow(position: 'above' | 'below') {
    if (!this.currentTable || !this.currentTableCell) return;
    
    // Lấy hàng hiện tại
    const currentRow = this.currentTableCell.parentElement as HTMLTableRowElement;
    if (!currentRow) return;
    
    // Lấy chỉ số hàng hiện tại
    const rowIndex = Array.from(this.currentTable.rows).indexOf(currentRow);
    
    // Tính toán vị trí để chèn
    const insertIndex = position === 'above' ? rowIndex : rowIndex + 1;
    
    // Tạo hàng mới
    const newRow = this.currentTable.insertRow(insertIndex);
    
    // Thêm các ô cho hàng mới
    for (let i = 0; i < currentRow.cells.length; i++) {
      const currentCell = currentRow.cells[i];
      const newCell = newRow.insertCell(i);
      
      // Sao chép các thuộc tính colspan và rowspan
      if (currentCell.hasAttribute('colspan')) {
        newCell.setAttribute('colspan', currentCell.getAttribute('colspan') || '');
      }
      
      // Kiểm tra xem ô hiện tại có rowspan > 1 không, nếu có thì tăng rowspan
      if (position === 'below' && parseInt(currentCell.getAttribute('rowspan') || '1') > 1) {
        // Tăng rowspan của ô hiện tại
        const rowspan = parseInt(currentCell.getAttribute('rowspan') || '1');
        currentCell.setAttribute('rowspan', (rowspan + 1).toString());
        
        // Xóa ô mới vì đã được bao phủ bởi ô có rowspan
        newCell.remove();
      } else {
        // Nếu không có rowspan, thêm nội dung mặc định
        newCell.innerHTML = '&nbsp;';
      }
    }
    
    // Cập nhật lại các handlers resize
    this.initColumnResizeHandlers();
  }

  insertColumn(position: 'left' | 'right') {
    if (!this.currentTable || !this.currentTableCell) return;
    
    // Lấy chỉ số cột hiện tại
    const cellIndex = this.getColumnIndex(this.currentTableCell);
    if (cellIndex === -1) return;
    
    // Tính toán vị trí để chèn
    const insertIndex = position === 'left' ? cellIndex : cellIndex + 1;
    
    // Thêm cột mới cho mỗi hàng
    for (let i = 0; i < this.currentTable.rows.length; i++) {
      const row = this.currentTable.rows[i];
      const newCell = document.createElement(row.cells[0].tagName); // Tạo cùng loại cell (th hoặc td)
      newCell.innerHTML = '&nbsp;';
      
      // Chèn ô mới vào vị trí thích hợp
      if (insertIndex >= row.cells.length) {
        row.appendChild(newCell);
      } else {
        row.insertBefore(newCell, row.cells[insertIndex]);
      }
    }
    
    // Cập nhật lại các handlers resize
    this.initColumnResizeHandlers();
  }

  deleteRow() {
    if (!this.currentTable || !this.currentTableCell) return;
    
    // Lấy hàng hiện tại
    const currentRow = this.currentTableCell.parentElement as HTMLTableRowElement;
    if (!currentRow) return;
    
    // Kiểm tra xem có ít nhất 2 hàng không
    if (this.currentTable.rows.length <= 1) {
      this.deleteTable();
      return;
    }
    
    // Xóa hàng
    currentRow.remove();
    
    // Cập nhật các handlers resize
    this.initColumnResizeHandlers();
  }

  deleteColumn() {
    if (!this.currentTable || !this.currentTableCell) return;
    
    // Lấy chỉ số cột hiện tại
    const cellIndex = this.getColumnIndex(this.currentTableCell);
    if (cellIndex === -1) return;
    
    // Kiểm tra xem có ít nhất 2 cột không
    const firstRow = this.currentTable.rows[0];
    if (firstRow && firstRow.cells.length <= 1) {
      this.deleteTable();
      return;
    }
    
    // Xóa cột cho mỗi hàng
    for (let i = 0; i < this.currentTable.rows.length; i++) {
      const row = this.currentTable.rows[i];
      if (cellIndex < row.cells.length) {
        row.deleteCell(cellIndex);
      }
    }
    
    // Cập nhật các handlers resize
    this.initColumnResizeHandlers();
  }

  mergeCells() {
    if (this.selectedCells.length <= 1) return;
    
    // Kiểm tra xem các ô đã chọn có liên tiếp không
    if (!this.isContiguousSelection()) {
      alert('Chỉ có thể gộp các ô liên tiếp');
      return;
    }
    
    // Lấy phạm vi hàng và cột
    const rowIndices = this.selectedCells.map(cell => this.getRowIndex(cell));
    const colIndices = this.selectedCells.map(cell => this.getColumnIndex(cell));
    
    const minRow = Math.min(...rowIndices);
    const maxRow = Math.max(...rowIndices);
    const minCol = Math.min(...colIndices);
    const maxCol = Math.max(...colIndices);
    
    // Tính toán colspan và rowspan
    const rowspan = maxRow - minRow + 1;
    const colspan = maxCol - minCol + 1;
    
    // Lấy ô đầu tiên (góc trên bên trái)
    const targetCell = this.currentTable?.rows[minRow].cells[minCol];
    if (!targetCell) return;
    
    // Đặt rowspan và colspan cho ô đích
    if (rowspan > 1) {
      targetCell.setAttribute('rowspan', rowspan.toString());
    }
    
    if (colspan > 1) {
      targetCell.setAttribute('colspan', colspan.toString());
    }
    
    // Gộp nội dung từ tất cả các ô được chọn
    let combinedContent = '';
    this.selectedCells.forEach(cell => {
      if (cell !== targetCell) {
        combinedContent += cell.innerHTML;
      }
    });
    
    // Thêm nội dung gộp vào ô đích
    targetCell.innerHTML += combinedContent;
    
    // Xóa các ô khác
    this.selectedCells.forEach(cell => {
      if (cell !== targetCell) {
        cell.remove();
      }
    });
    
    // Xóa lựa chọn
    this.clearSelectedCells();
    
    // Cập nhật lại các handlers resize
    this.initColumnResizeHandlers();
  }

  splitCell() {
    if (!this.currentTableCell || !this.currentTable) return;
    
    // Lấy rowspan và colspan
    const rowspan = parseInt(this.currentTableCell.getAttribute('rowspan') || '1');
    const colspan = parseInt(this.currentTableCell.getAttribute('colspan') || '1');
    
    // Nếu không có rowspan hoặc colspan > 1, không cần tách
    if (rowspan === 1 && colspan === 1) return;
    
    // Lấy vị trí của ô hiện tại
    const rowIndex = this.getRowIndex(this.currentTableCell);
    const colIndex = this.getColumnIndex(this.currentTableCell);
    
    // Xóa rowspan và colspan
    this.currentTableCell.removeAttribute('rowspan');
    this.currentTableCell.removeAttribute('colspan');
    
    // Nội dung của ô gốc
    const content = this.currentTableCell.innerHTML;
    
    // Tách theo cột trước
    for (let i = 0; i < rowspan; i++) {
      const currentRow = this.currentTable.rows[rowIndex + i];
      if (!currentRow) continue;
      
      for (let j = 0; j < colspan; j++) {
        // Bỏ qua ô gốc (i=0, j=0)
        if (i === 0 && j === 0) continue;
        
        // Thêm ô mới
        const newCell = document.createElement(this.currentTableCell.tagName);
        newCell.innerHTML = '&nbsp;';
        
        // Chèn ô mới vào vị trí thích hợp
        if (colIndex + j >= currentRow.cells.length) {
          currentRow.appendChild(newCell);
        } else {
          currentRow.insertBefore(newCell, currentRow.cells[colIndex + j]);
        }
      }
    }
    
    // Cập nhật lại các handlers resize
    this.initColumnResizeHandlers();
  }

  deleteTable() {
    if (!this.currentTable) return;
    
    // Lấy container của bảng và xóa
    const tableContainer = this.currentTable.closest('.table-container');
    if (tableContainer) {
      tableContainer.remove();
    } else {
      this.currentTable.remove();
    }
    
    // Xóa các biến tham chiếu
    this.currentTable = null;
    this.currentTableCell = null;
    this.clearSelectedCells();
    
    // Ẩn menu và controls
    this.hideTableMenu();
    this.hideTableControls();
  }

  isContiguousSelection(): boolean {
    if (this.selectedCells.length <= 1) return true;
    
    // Lấy phạm vi hàng và cột
    const rowIndices = this.selectedCells.map(cell => this.getRowIndex(cell));
    const colIndices = this.selectedCells.map(cell => this.getColumnIndex(cell));
    
    const minRow = Math.min(...rowIndices);
    const maxRow = Math.max(...rowIndices);
    const minCol = Math.min(...colIndices);
    const maxCol = Math.max(...colIndices);
    
    // Kiểm tra xem tất cả các ô trong phạm vi đã được chọn chưa
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        // Tìm ô tại vị trí (i, j)
        const cell = this.currentTable?.rows[i]?.cells[j];
        if (!cell || !this.selectedCells.includes(cell)) {
          return false;
        }
      }
    }
    
    return true;
  }
}
