Should be a link
================

In accessibility, it's important to make sure that links are styled as links.

I'd like to see if that I can build a simple ML model that detects if a link is styled as a button or not.

Proposal
--------

I'm not too sure how to do this, but I think it would be something like:

1. Get the data. What do buttons look like?
  1. Get a list of links.
  2. Get a list of buttons.
  3. Get an image of each button.
  4. Hand validate the images.
2. Split the data into a training set and a test set.
3. Train a model
4. Evaluate the model.
5. Deploy the model.