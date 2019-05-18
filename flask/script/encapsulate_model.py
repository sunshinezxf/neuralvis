from keras.models import Model
from keras.models import load_model
from PIL import Image
from nn.network_model import prepare_image
import numpy as np

origin_model = load_model('../networks/models/resnet_mnist_1_f5cd88ca-1e26-11e9-9bea-acde48001122.h5')
print(origin_model.to_json())


# def generate_encapsulate_model(model):
#     enc_model = Model(
#         inputs=model.input,
#         # ignore 1st layer (input), since some old models do not have 1st layer as Keras layer
#         outputs=list(map(lambda layer: layer.output, model.layers[1:]))
#     )
#     return enc_model


# encapsulate_model = generate_encapsulate_model(origin_model)

# image = Image.open('../networks/images/7_1_8d0f561c-d84c-11e8-94cf-acde48001122.jpg')
# image = prepare_image(image, target_shape=(28, 28, 1))
# image = image / 255
# image = np.asarray([image])
# print(image.shape)
# results = encapsulate_model.predict(image)
#
# for o in results:
#     shp = o[0].shape
#     t1 = o[0][:, :, 0].reshape(-1)
#     t2 = o[0].reshape(-1)[::shp[2]]
#     print(t1 - t2)
