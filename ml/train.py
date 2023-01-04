import numpy as np
import os
import PIL
import PIL.Image
import tensorflow as tf
import random
import pathlib

print(tf.__version__) # PK - not sure how to bump the verison.

dataset_url = "https://github.com/PaulKinlan/button-and-link-scraper/releases/download/latest/images.tgz"
data_dir = tf.keras.utils.get_file(origin=dataset_url,
                                   fname="images",
                                   untar=True)
data_dir = pathlib.Path(data_dir)

print(data_dir)

image_count = len(list(data_dir.glob('*/**/*.png')))
print(image_count)

buttons = list(data_dir.glob('buttons/*.png'))
PIL.Image.open(str(random.choice(buttons)))

text_links = list(data_dir.glob('text-links/*'))
PIL.Image.open(str(random.choice(text_links)))

print(len(text_links))
print(len(buttons))

batch_size = 32
img_height = 256
img_width = 256

train_ds = tf.keras.utils.image_dataset_from_directory(
  data_dir,
  validation_split=0.4,
  subset="training",
  seed=123,
  image_size=(img_height, img_width),
  batch_size=batch_size)

val_ds = tf.keras.utils.image_dataset_from_directory(
  data_dir,
  validation_split=0.4,
  subset="validation",
  seed=123,
  image_size=(img_height, img_width),
  batch_size=batch_size)

class_names = train_ds.class_names
print(class_names)

import matplotlib.pyplot as plt

plt.figure(figsize=(10, 10))
for images, labels in train_ds.take(1):
  for i in range(9):
    ax = plt.subplot(3, 3, i + 1)
    plt.imshow(images[i].numpy().astype("uint8"))
    plt.title(class_names[labels[i]])
    plt.axis("off")


AUTOTUNE = tf.data.AUTOTUNE

train_ds = train_ds.cache().prefetch(buffer_size=AUTOTUNE)
val_ds = val_ds.cache().prefetch(buffer_size=AUTOTUNE)

num_classes = len(class_names)

# Given the sample set is not the largest, randomize some changes.
saturation_training = train_ds.map(lambda x, y: (tf.image.stateless_random_saturation(x, 0.5, 1.0, (2, 3)), y))
hue_training = train_ds.map(lambda x, y: (tf.image.stateless_random_hue(x, 0.5, (2, 3)), y))
contrast_training = train_ds.map(lambda x, y: (tf.image.stateless_random_contrast(x, 0.2, 1.0, (2, 3)), y))

# Merge the transformations.
train_ds = saturation_training.concatenate(hue_training).concatenate(contrast_training)

# Now apply random rotations.
rotation_training = train_ds.map(lambda x, y: (tf.keras.layers.RandomRotation((-0.2, 0.3))(x), y))

# Add them on.
train_ds = train_ds.concatenate(rotation_training)

print(rain_ds.reduce(0, lambda x, _: x + 1))

normalization_layer = tf.keras.layers.Rescaling(1./255)
normalized_train_ds = train_ds.map(lambda x, y: (normalization_layer(x), y))
normalized_val_ds = val_ds.map(lambda x, y: (normalization_layer(x), y))

# Cache the training sets.
normalized_train_ds = normalized_train_ds.cache().prefetch(buffer_size=AUTOTUNE)
normalized_val_ds = normalized_val_ds.cache().prefetch(buffer_size=AUTOTUNE)

model = tf.keras.Sequential([
  tf.keras.layers.Conv2D(32, 3, activation='relu', input_shape=[img_height, img_width, 3]),
  tf.keras.layers.MaxPooling2D(),
  tf.keras.layers.Conv2D(32, 3, activation='relu'),
  tf.keras.layers.MaxPooling2D(),
  tf.keras.layers.Conv2D(32, 3, activation='relu'),
  tf.keras.layers.MaxPooling2D(),
  tf.keras.layers.Flatten(),
  tf.keras.layers.Dense(128, activation='relu'),
  tf.keras.layers.Dense(num_classes) #  activation='softmax' ??
])

model.compile(
  optimizer='adam',
  loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
  metrics=['accuracy'])

history = model.fit(
  normalized_train_ds,
  validation_data = normalized_val_ds,
  epochs=10
).history

plt.figure()
plt.ylabel("Loss (training and validation)")
plt.xlabel("Training Steps")
plt.ylim([0,2])
plt.plot(history["loss"])
plt.plot(history["val_loss"])

plt.figure()
plt.ylabel("Accuracy (training and validation)")
plt.xlabel("Training Steps")
plt.ylim([0,1])
plt.plot(history["accuracy"])
plt.plot(history["val_accuracy"])

# Export model to tensorflowJS following: https://blog.tensorflow.org/2018/07/train-model-in-tfkeras-with-colab-and-run-in-browser-tensorflowjs.html

model.save('keras.h5')

!pip install tensorflowjs 
!mkdir model
!tensorflowjs_converter --input_format keras keras.h5 model/
!zip -r model.zip model 

files.download('model.zip')

# Test the model.
from google.colab import files
from keras.utils import load_img, img_to_array

uploaded = files.upload()

for fn in uploaded.keys():
  img = load_img(fn, target_size=(256, 256))
  x = img_to_array(img)

  x = x / 255.0
  x = tf.expand_dims(x, 0)
  
  classes = model.predict(x, batch_size=32)
  print(classes)
  score = tf.nn.softmax(classes[0])
  print(
    "This image most likely belongs to {} with a {:.2f} percent confidence."
    .format(class_names[np.argmax(score)], 100 * np.max(score)))