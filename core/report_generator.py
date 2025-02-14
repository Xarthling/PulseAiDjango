from fpdf import FPDF
import os
import base64
import re

class ReportGenerator:
    """
    A class responsible for creating PDF reports with text, images, and formatting.
    """
    BASE64_PATTERN = re.compile(r'^[A-Za-z0-9+/]+={0,2}$')  # Regex to do a naive base64 check

    IMAGE_MAX_WIDTH = 90
    IMAGE_MAX_HEIGHT = 60
    IMAGE_MARGIN = 10

    def __init__(self, output_path: str):
        """
        Initialize the ReportGenerator with the output path and set up the PDF document.
        """
        self.output_path = output_path
        self.pdf = FPDF()
        self.pdf.set_auto_page_break(auto=True, margin=10)
        self.pdf.add_page()
        self.pdf.set_font("Arial", size=10)

    def add_title(self, title: str) -> None:
        """
        Add a title to the PDF document.
        """
        self.pdf.set_font("Arial", 'B', size=14)
        self.pdf.cell(200, 8, txt=title, ln=True, align='C')
        self.pdf.ln(5)

    def add_cards(self, cards: dict) -> None:
        """
        Add key-value pairs as cards to the PDF document.
        """
        self.pdf.set_font("Arial", size=10)
        for key, value in cards.items():
            self.pdf.cell(200, 8, txt=f"{key}: {value}", ln=True)
        self.pdf.ln(5)

    def add_filters(self, filters: dict) -> None:
        """
        Add filters to the PDF document.
        """
        self.pdf.set_font("Arial", 'B', size=10)
        self.pdf.cell(200, 8, txt="Filters Applied:", ln=True)
        self.pdf.set_font("Arial", size=10)
        for filter_key, filter_value in filters.items():
            if filter_value is None:
                filter_value = "No Filter selected"
            self.pdf.cell(200, 8, txt=f"{filter_key}: {filter_value}", ln=True)
        self.pdf.ln(5)

    def decode_and_save_images(self, graphs: list) -> list:
        """
        Decode base64 images and save them to disk.
        Returns a list of file paths to the saved images.
        Raises ValueError if any image fails to decode.
        """
        graph_paths = []
        os.makedirs(os.path.dirname(self.output_path), exist_ok=True)  # Ensure output dir exists

        for i, graph in enumerate(graphs):
            if not self.is_valid_base64(graph):
                raise ValueError(f"Invalid Base64 string at index {i}")

            try:
                image_data = base64.b64decode(graph)
            except Exception as e:
                raise ValueError(f"Error decoding Base64 image at index {i}: {str(e)}")

            image_path = f"static/reports/graph_{i}.png"
            with open(image_path, 'wb') as f:
                f.write(image_data)
            graph_paths.append(image_path)

        return graph_paths

    def is_valid_base64(self, s: str) -> bool:
        """
        Validate the string against a naive base64 regex, 
        and check that the length is divisible by 4.
        """
        if not s or len(s) % 4 != 0:
            return False
        return bool(self.BASE64_PATTERN.match(s))

    def add_graphs(self, graph_paths):
        """
        Add graphs to the PDF document in a 2-column grid layout, 
        automatically adding new pages when space is insufficient.
        """
        self.pdf.set_font("Arial", 'B', size=10)
        self.pdf.cell(200, 8, txt="Graphs:", ln=True)
        self.pdf.ln(5)

        # Starting positions and layout constants
        COLS = 2
        x_start = self.pdf.l_margin   # Left margin
        y_start = self.pdf.get_y()    # Current cursor y
        x = x_start
        y = y_start
        col_count = 0  # Track how many columns are filled in the current row

        for i, graph_path in enumerate(graph_paths):
            # 1. Check if there's enough space left on the current page for the image
            if y + self.IMAGE_MAX_HEIGHT > (self.pdf.h - self.pdf.b_margin):
                # Not enough space: create a new page
                self.pdf.add_page()
                # Reset x, y, and col_count for the new page
                x = x_start
                y = self.pdf.get_y()
                col_count = 0

            # 2. Place the image at (x, y)
            self.pdf.image(graph_path, x=x, y=y, w=self.IMAGE_MAX_WIDTH, h=self.IMAGE_MAX_HEIGHT)

            # 3. Move to the next column
            col_count += 1
            if col_count == COLS:
                # If we've hit the max columns, go to the next row
                col_count = 0
                x = x_start
                y += self.IMAGE_MAX_HEIGHT + self.IMAGE_MARGIN
            else:
                # Otherwise, shift x to the right for the second column
                x += self.IMAGE_MAX_WIDTH + self.IMAGE_MARGIN

        # 4. Move the cursor below the last row of images
        self.pdf.set_y(y + self.IMAGE_MAX_HEIGHT + self.IMAGE_MARGIN)

    def save_pdf(self) -> None:
        """
        Save the PDF document to the specified output path.
        """
        self.pdf.output(self.output_path)
