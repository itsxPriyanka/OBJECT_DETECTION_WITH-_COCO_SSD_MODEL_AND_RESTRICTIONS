import React, { useRef, useState, useEffect } from "react";
import styled from "styled-components";
import Swal from 'sweetalert2';
import { S3 } from 'aws-sdk';
import * as cocoSsd from "@tensorflow-models/coco-ssd";

const PlusButton = styled.div`
  width: 10%;
  height: 10%;
  background-color: white;
  display: flex;
  flex-direction: column;
  align-items: right;
  justify-content: right;
  color: blue;
  cursor: pointer;
`;

const ObjectDetectorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: right;
  background-color: white;
`;

const HiddenFileInput = styled.input`
  display: none;
  background-color: white;
`;

const SelectButton = styled.button`
  padding: 7px 10px;
  border: 2px solid transparent;
  background-color: #ffff;
  color: #0a0f22;
  font-size: 16px;
  font-weight: 500;
  outline: none;
  margin-top: 2em;
  cursor: pointer;
  transition: all 260ms ease-in-out;
  background-color: white;

  &:hover {
    background-color: white;
    border: 2px solid #fff;
    color: light blue;
  }
`;

// Initialize S3 with environment variables
const s3 = new S3({
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  region: process.env.REACT_APP_AWS_REGION,
});

export function ObjectDetector(props) {
  const fileInputRef = useRef();
  const imageRef = useRef();
  const [imgData, setImgData] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [isLoading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [model, setModel] = useState(null);

  useEffect(() => {
    const loadModel = async () => {
      const loadedModel = await cocoSsd.load({});
      setModel(loadedModel);
    };
    loadModel();
  }, []);

  const openFilePicker = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const detectObjectsOnImage = async (imageElement) => {
    const model = await cocoSsd.load({});
    const predictions = await model.detect(imageElement);

    const hasHumanOrAnimal = predictions.some(
      (prediction) =>
        prediction.class === 'person' ||
        prediction.class === 'bird' ||
        prediction.class === 'cat' ||
        prediction.class === 'dog'
    );

    if (hasHumanOrAnimal) {
      Swal.fire('Invalid image', 'This image contains a human or animal.', 'error');
    } else {
      const confirmation = await Swal.fire({
        title: 'Valid image',
        text: 'Do you want to store this image?',
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Yes, upload!',
        cancelButtonText: 'No, cancel'
      });

      if (confirmation.isConfirmed) {
        const imageBlob = await fetch(imageElement.src).then((res) => res.blob());
        const imageName = `valid-image-${Date.now()}.jpg`;
        const uploadParams = {
          Bucket: process.env.REACT_APP_S3_BUCKET_NAME,
          Key: imageName,
          Body: imageBlob,
          ContentType: 'image/jpeg'
        };
        try {
          const data = await s3.upload(uploadParams).promise();
          console.log('Image uploaded successfully:', data.Location);
        } catch (error) {
          console.error('Error uploading image to S3:', error);
        }
      }
    }
  };

  const readImage = (file) => {
    return new Promise((resolve, reject) => {
      if (!(file instanceof Blob)) {
        reject(new Error("Invalid file type. Please select a valid file."));
        return;
      }
  
      const fileReader = new FileReader();
      fileReader.onload = () => resolve(fileReader.result);
      fileReader.onerror = () => reject(fileReader.error);
      fileReader.readAsDataURL(file);
    });
  };

  const onSelectFile = async (e) => {
    if (!e.target || !e.target.files || e.target.files.length === 0) {
      return;
    }
  
    setLoading(true);
    const file = e.target.files[0];
  
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      Swal.fire('Invalid file type', 'Please select an image or PDF file.', 'error');
      setLoading(false);
      return;
    }
  
    if (file.type === 'application/pdf') {
      const pdfData = await readPdf(file);
      if (pdfData.isValid) {
        const confirmation = await Swal.fire({
          title: 'Valid PDF',
          text: 'Do you want to upload this PDF?',
          icon: 'success',
          showCancelButton: true,
          confirmButtonText: 'Yes, upload',
          cancelButtonText: 'No, cancel'
        });
  
        if (confirmation.isConfirmed) {
          const pdfBlob = await fetch(pdfData.data).then((res) => res.blob());
          const pdfName = `valid-pdf-${Date.now()}.pdf`;
          const uploadParams = {
            Bucket: process.env.REACT_APP_S3_BUCKET_NAME,
            Key: pdfName,
            Body: pdfBlob,
            ContentType: 'application/pdf'
          };
          try {
            const data = await s3.upload(uploadParams).promise();
            console.log('PDF uploaded successfully:', data.Location);
          } catch (error) {
            console.error('Error uploading PDF to S3:', error);
          }
        }
      } else {
        Swal.fire('Invalid PDF', 'The PDF file is not valid.', 'error');
      }
      setLoading(false);
      return;
    }
  
    const imgData = await readImage(file);
    const imageElement = document.createElement("img");
    imageElement.src = imgData;
  
    imageElement.onload = async () => {
      await detectObjectsOnImage(imageElement);
      setLoading(false);
    };
  };
  
  const readPdf = (file) => {
    return new Promise((resolve, reject) => {
      if (!(file instanceof Blob)) {
        reject(new Error("Invalid file type. Please select a valid file."));
        return;
      }
  
      const fileReader = new FileReader();
      fileReader.onload = () => resolve({ isValid: true, data: fileReader.result });
      fileReader.onerror = () => reject(fileReader.error);
      fileReader.readAsDataURL(file);
    });
  };

  return (
    <>
      <ObjectDetectorContainer>
        <HiddenFileInput
          type="file"
          ref={fileInputRef}
          onChange={onSelectFile}
        />
        <SelectButton onClick={openFilePicker}>
          +
        </SelectButton>
      </ObjectDetectorContainer>
    </>
  );
}
