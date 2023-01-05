const canvas = document.getElementById('whiteboard');
const context = canvas.getContext('2d');

// Set the canvas size to match the size of the parent element
canvas.width = canvas.parentElement.clientWidth;
canvas.height = canvas.parentElement.clientHeight;

// Initialize the shape and color variables
let currentShape = null;
let currentColor = '#000000';

// Array to store the shapes that have been added to the canvas
const shapes = [];

// Flag to keep track of whether a shape is currently being dragged
let isDragging = false;

// Flag to keep track of whether a shape is currently selected
let isShapeSelected = false;

// Variables to store the mouse position and the shape position when a shape is selected
let mouseX, mouseY, shapeX, shapeY;

// Initialize the shape buttons and the color picker
const rectangleButton = document.getElementById('rectangle-button');
const circleButton = document.getElementById('circle-button');
const triangleButton = document.getElementById('triangle-button');
const colorPicker = document.getElementById('color-picker');

// Add click listeners to the shape buttons to set the current shape
rectangleButton.addEventListener('click', () => {
  currentShape = 'rectangle';
});
circleButton.addEventListener('click', () => {
  currentShape = 'circle';
});
triangleButton.addEventListener('click', () => {
  currentShape = 'triangle';
});

// Add a change listener to the color picker to set the current color
colorPicker.addEventListener('change', () => {
  currentColor = colorPicker.value;
});

// Add mousedown, mousemove, and mouseup event listeners to the canvas
canvas.addEventListener('mousedown', onMouseDown);
canvas.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('mouseup', onMouseUp);
// Add a mouseover event listener to the canvas
canvas.addEventListener('mouseover', onMouseOver);

// mousedown event handler for shapes
function onShapeMouseDown(event, shape) {
    // Set the shape selected flag to true
    isShapeSelected = true;
  
    // Store the mouse position and the shape position
    mouseX = event.clientX;
    mouseY = event.clientY;
    shapeX = shape.x;
    shapeY = shape.y;
  }

// mouseover event handler
function onMouseOver(event) {
    // Calculate the position of the mouse on the canvas
    const x = event.clientX - canvas.offsetLeft;
    const y = event.clientY - canvas.offsetTop;
  
    // Check if the mouse is over any of the shapes
    let selectedShape = null;
    shapes.forEach((shape) => {
      if (isMouseOverShape(shape, x, y)) {
        selectedShape = shape;
      }
    });
  
    // If a shape is selected, change the cursor to a move cursor
    if (selectedShape) {
      canvas.style.cursor = 'move';
    } else {
      canvas.style.cursor = 'default';
    }
  }

// mousedown event handler
function onMouseDown(event) {
  // Check if a shape is selected
  if (currentShape) {
    // Calculate the position of the mouse on the canvas
    const x = event.clientX - canvas.offsetLeft;
    const y = event.clientY - canvas.offsetTop;

    // Create a new shape and add it to the array of shapes
    const shape = createShape(currentShape, x, y, currentColor);
    shapes.push(shape);

    // Set the dragging flag to true
    isDragging = true;
  }
}

// mousemove event handler
function onMouseMove(event) {
    // Check if a shape is being dragged
    if (isDragging) {
      // Calculate the position of the mouse on the canvas
      const x = event.clientX - canvas.offsetLeft;
      const y = event.clientY - canvas.offsetTop;
  
      // Update the position of the shape that is being dragged
      const shape = shapes[shapes.length - 1];
      shape.x = x;
      shape.y = y;
  
      // Redraw the canvas
      drawShapes();
    } else if (isShapeSelected) {
      // Calculate the difference between the current mouse position and the stored mouse position
      const dx = event.clientX - mouseX;
      const dy = event.clientY - mouseY;
  
      // Update the position of the selected shape
      const shape = shapes[shapes.length - 1];
      shape.x = shapeX + dx;
      shape.y = shapeY + dy;
  
      // Redraw the canvas
      drawShapes();
    }
  }
  
  // mouseup event handler
  function onMouseUp() {
    // Reset the dragging flag
    isDragging = false;
    
    isShapeSelected = false;
  }
  
  // Function to create a new shape object
  function createShape(type, x, y, color) {
    let shape;
  
    // Create a new object based on the type of shape
    switch (type) {
      case 'rectangle':
        shape = {
          type: 'rectangle',
          x: x,
          y: y,
          width: 50,
          height: 50,
          color: color,
          rotation: 0,
        };
        break;
      case 'circle':
        shape = {
          type: 'circle',
          x: x,
          y: y,
          radius: 25,
          color: color,
          rotation: 0,
        };
        break;
      case 'triangle':
        shape = {
          type: 'triangle',
          x: x,
          y: y,
          size: 50,
          color: color,
          rotation: 0,
        };
        break;
    }
  
    return shape;
  }
  
  // Function to draw all the shapes on the canvas
  function drawShapes() {
    // Clear the canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
  
    // Loop through all the shapes and draw them on the canvas
    shapes.forEach((shape) => {
      switch (shape.type) {
        case 'rectangle':
          drawRectangle(shape);
          break;
        case 'circle':
          drawCircle(shape);
          break;
        case 'triangle':
          drawTriangle(shape);
          break;
      }
    });
  }
  
  // Function to draw a rectangle on the canvas
  function drawRectangle(rectangle) {
    context.save();
  
    // Translate the canvas to the center of the rectangle, and rotate it
    context.translate(rectangle.x + rectangle.width / 2, rectangle.y + rectangle.height / 2);
    context.rotate(rectangle.rotation * Math.PI / 180);
  
    // Draw the rectangle on the canvas
    context.fillStyle = rectangle.color;
    context.fillRect(-rectangle.width / 2, -rectangle.height / 2, rectangle.width, rectangle.height);
  
    context.restore();

    canvas.addEventListener('mousedown', (event) => onShapeMouseDown(event, rectangle));
  }
  
// Function to draw a circle on the canvas
function drawCircle(circle) {
    context.save();
  
    // Translate the canvas to the center of the circle, and rotate it
    context.translate(circle.x, circle.y);
    context.rotate(circle.rotation * Math.PI / 180);
  
    // Draw the circle on the canvas
    context.beginPath();
    context.arc(0, 0, circle.radius, 0, 2 * Math.PI);
    context.fillStyle = circle.color;
    context.fill();
  
    context.restore();

    canvas.addEventListener('mousedown', (event) => onShapeMouseDown(event, circle));
  }
  
  // Function to draw a triangle on the canvas
  function drawTriangle(triangle) {
    context.save();
  
    // Translate the canvas to the center of the triangle, and rotate it
    context.translate(triangle.x, triangle.y);
    context.rotate(triangle.rotation * Math.PI / 180);
  
    // Draw the triangle on the canvas
    context.beginPath();
    context.moveTo(0, -triangle.size / 2);
    context.lineTo(-triangle.size / 2, triangle.size / 2);
    context.lineTo(triangle.size / 2, triangle.size / 2);
    context.closePath();
    context.fillStyle = triangle.color;
    context.fill();
  
    context.restore();

    canvas.addEventListener('mousedown', (event) => onShapeMouseDown(event, triangle));
  }