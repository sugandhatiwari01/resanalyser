import pdfplumber

def extract_text_from_pdf(file_stream):
    """
    Extracts clean text from uploaded PDF resume.
    Works well with multi-column and formatted resumes.
    """
    text = ""

    try:
        with pdfplumber.open(file_stream) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"

        return text.strip()

    except Exception as e:
        raise Exception(f"PDF extraction failed: {str(e)}")