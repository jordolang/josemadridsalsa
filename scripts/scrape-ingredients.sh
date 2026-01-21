#!/bin/bash

# Check if tesseract is installed
if ! [ -x "$(command -v tesseract)" ]; then
  echo 'Error: tesseract is not installed. Please install it to continue.' >&2
  exit 1
fi

# Set the image and output directories
IMAGE_DIR="public/images/new-products/labels"
OUTPUT_DIR="scripts/ingredients-text"

# Create the output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Iterate through the images and extract text
for image_file in "$IMAGE_DIR"/*.jpg "$IMAGE_DIR"/*.png "$IMAGE_DIR"/*.JPG; do
  # Check if the file exists to avoid errors when no files of a certain type are found
  [ -e "$image_file" ] || continue

  # Get the base name of the image file
  base_name=$(basename "$image_file")
  base_name_no_ext="${base_name%.*}"
  
  # Set the output file path
  output_file="$OUTPUT_DIR/$base_name_no_ext"
  
  # Run tesseract and save the output
  echo "Processing $image_file..."
  tesseract "$image_file" "$output_file" -l eng
done

echo "Done. Extracted text saved in $OUTPUT_DIR"
