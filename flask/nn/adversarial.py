import keras
import numpy as np
# import cv2

from PIL import Image

from nn import network_model as nm
from foolbox.models import KerasModel
from foolbox.attacks import LBFGSAttack
from foolbox.attacks import SinglePixelAttack
from foolbox.criteria import TargetClassProbability

import os

from config import basedir, Config

# learning phase flag: 0-test, 1-train
keras.backend.set_learning_phase(0)

image_path = '/Users/fan/Documents/Python/nvis/flask/networks/images/adversarial/'


def sample_attack(keras_model, image, attack_method, input_name, labeled, target=0):
    """
     对于给定的模型和输入，本方法将使用指定的攻击方法生成攻击图片
    :return:
    """
    input_shape = nm.extract_input_shape(keras_model)[1:]
    image = nm.prepare_image(image, input_shape)
    layer_input = [image]
    label = keras_model.predict(np.asarray(layer_input))
    label = np.argmax(label)
    if labeled is not None and not label == labeled:
        return None, "This image cannot be correctly classified, no adversarial sample will be generated. expected: " + str(labeled) + " actual: " + str(label)
    network_model = KerasModel(keras_model, bounds=(0, 1))

    # run the attack
    if str(attack_method).lower() == 'lbfgs':
        attack = LBFGSAttack(model=network_model, criterion=TargetClassProbability(target, p=.5))
    elif str(attack_method).lower() == 'singlepixelattack':
        attack = SinglePixelAttack(model=network_model, criterion=TargetClassProbability(target, p=.5))
    else:
        return "Attack method not supported at the moment"
    print(label)
    if label == target:
        target = (target + 1) % 10
    adversarial = attack(image[:, :, ::-1], label)
    output = network_model.predictions(adversarial)
    print(np.argmax(output))
    adversarial = adversarial.reshape(input_shape)
    adversarial = adversarial * 255
    adv_image_name = 'adv_{}_origin_{}_{}_{}'.format(target, label, attack_method, input_name)
    print(adversarial.shape)
    im = None
    if len(adversarial.shape) == 2:
        im = Image.fromarray(np.uint8(adversarial), mode="1")
    if len(adversarial.shape) == 3 and adversarial.shape[2] == 1:
        im = Image.fromarray(np.uint8(adversarial.reshape(adversarial.shape[0], adversarial.shape[1])), mode="L")
    if len(adversarial.shape) == 3 and adversarial.shape[2] == 3:
        im = Image.fromarray(np.uint8(adversarial), mode="RGB")
    im.save(os.path.join(basedir, Config.UPLOAD_IMAGE_FOLDER, adv_image_name))
    # cv2.imwrite(os.path.join(basedir, Config.UPLOAD_IMAGE_FOLDER, adv_image_name), adversarial)
    print('adv', adv_image_name)
    return adversarial, adv_image_name
