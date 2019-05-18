# -*- coding: utf-8 -*-

import os
import json
import math
from io import StringIO

import keras

from keras.models import Sequential
from keras import backend as backend
from keras.preprocessing.image import img_to_array

from keras.layers import Conv2D, Dense, Flatten, MaxPooling2D

from keras.datasets import mnist

import numpy as np

from store import structure_output


def load_model(model_path):
    """
    :param model_path: absolute path of the model on server
    :return: network model
    """
    # Each time a model is loaded, session need to be cleared
    backend.clear_session()
    print(model_path)
    target_model = keras.models.load_model(model_path)
    return target_model


def prepare_image(original_image, target_shape):
    """
    :param original_image: the original image from the input layer
    :param target_shape: target shape extracted from the config of 1st layer
    :return:
    """
    image = None
    if len(target_shape) == 1:
        # The mode of an image defines the type and depth of a pixel in the image
        # 1 (1-bit pixels, black and white, stored with one pixel per byte)
        # L (8-bit pixels, black and white)
        # P (8-bit pixels, mapped to any other mode using a color palette)
        # RGB (3x8-bit pixels, true color)
        # RGBA (4x8-bit pixels, true color with transparency mask)
        # CMYK (4x8-bit pixels, color separation)
        # YCbCr (3x8-bit pixels, color video format)
        # LAB (3x8-bit pixels, the L*a*b color space)
        # HSV (3x8-bit pixels, Hue, Saturation, Value color space)
        # I (32-bit signed integer pixels)
        # F (32-bit floating point pixels)
        # L = R * 299/1000 + G * 587/1000 + B * 114/1000
        image = original_image.convert("1")
        image = image.resize((int(math.sqrt(target_shape[0])), int(math.sqrt(target_shape[0]))))
        image = img_to_array(image)
        image = image.reshape(target_shape)
        image = image / 255
    elif len(target_shape) == 3 and target_shape[2] == 1:
        print(original_image)
        image = original_image.convert("L")
        image = image.resize((target_shape[0], target_shape[1]))
        image = img_to_array(image)
        image = image / 255
    elif len(target_shape) == 3 and target_shape[2] == 3:
        image = original_image.convert("RGB")
        image = image.resize((target_shape[0], target_shape[1]))
        image = img_to_array(image)
        image = image / 255
    if len(target_shape) == 3:
        image = image.reshape(target_shape[0], target_shape[1], target_shape[2])
        print(image.shape)
    # return the processed image
    return image


def extract_layers(network_model):
    # print(json.load(StringIO(network_model.to_json())))
    json_data = json.loads(network_model.to_json())
    print(type(json_data).__name__)
    print(type(json_data['config']).__name__)
    if type(json_data['config']).__name__ != 'list':
        return json_data['config']['layers']
    else:
        return json_data['config']


def index_of_layer(network_model, layer_name):
    """
    :param network_model: The current network model
    :param layer_name: name of the specified model
    :return:
    """
    # Extract layers from the network model
    layers = extract_layers(network_model)
    for index in range(len(layers)):
        if layers[index]['config']['name'] == layer_name:
            return index
    # If not matched, -1 will be returned
    return -1


def extract_input_shape(model):
    """
    This method will extract the input shape of the network model
    :param model: network model
    :return: input shape of the first layer
    """
    input_shape = model.layers[0].input_shape
    return input_shape


def normalize(layer_output):
    """
    该方法将每一层的输出归一化
    :return:
    """
    if layer_output.max() == 0:
        return layer_output * 0
    return layer_output / layer_output.max()


def inner_output(model, layer_input, index=0):
    """
    This method will calculate the output of the model with the provided input over the specified layer
    :param model: original network model
    :param layer_input: input need to be applied
    :param index: output of layer index
    :return: output
    """
    # one layer will be calculated
    target_output = backend.function([model.layers[index].input], [model.layers[index].output])
    result = target_output([layer_input])[0]
    return result


def prepare_input(layer_input, hidden_config, layer_name):
    """
    This method is used to preprocess the input data for the next layer is any hidden config is available
    :param layer_input:
    :param hidden_config:
    :param layer_name:
    :return:
    """
    index_list = []
    # 读取hidden_config中名称和当前层名称相同的数据
    for index in range(len(hidden_config)):
        if layer_name == hidden_config[index]['layer_name']:
            index_list.append(int(hidden_config[index]['feature_index']))
    if len(index_list) == 0:
        return layer_input
    for index in range(len(index_list)):
        feature_index = index_list[index]
        layer_input[0][:, :, feature_index][layer_input[0][:, :, feature_index] >= 0] = 0
        layer_input[0][:, :, feature_index][layer_input[0][:, :, feature_index] < 0] = 0
    return layer_input


def model_output(network_model, image, target_layer=None, hidden_config=None):
    """
    This model will return the output of the target layer
    if not specified, the whole output will be calculated
    :param network_model: model
    :param image: prepared image
    :param target_layer: optional, layer_name if provided, only that layer will be calculated
    :param hidden_config: optional, if provided, changes will be applied to some input [{layer_name: xxx, feature_index: xxx}]
    :return: an array of output
    """
    input_shape = extract_input_shape(network_model)[1:]
    image = prepare_image(image, input_shape)
    layer_input = [image]
    layers = extract_layers(network_model)
    result_list = []
    if target_layer == "input":
        temp_result = dict()
        temp_result['name'] = layers[0]['config']['name']
        temp_result['index'] = 0
        temp_result['data'] = [image.tolist()]
        result_list.append(temp_result)
        return result_list
    index = index_of_layer(network_model, target_layer)
    start = 0
    if layers[0]['class_name'] == 'InputLayer':
        start = 1
    for i in range(start, len(layers)):
        layer_output = inner_output(network_model, layer_input, i)
        # If no hidden layer, then the output will be directly used as the input for next layer
        # Else, find the feature index and change the corresponding value to 0 array
        if hidden_config is None:
            layer_input = layer_output
        else:
            layer_input = prepare_input(layer_output, hidden_config, layers[i]['config']['name'])
        if target_layer is None or target_layer == '':
            temp_result = dict()
            temp_result['name'] = layers[i]['config']['name']
            temp_result['index'] = i
            temp_result['data'] = layer_output.tolist()
            result_list.append(temp_result)
        else:
            if index >= 0 and index == i:
                temp_result = dict()
                temp_result['name'] = layers[i]['config']['name']
                temp_result['index'] = i
                temp_result['data'] = layer_output.tolist()
                result_list.append(temp_result)
                return result_list
    return result_list


def model_output4tensor(network_model, image, hidden_config=None, layer=None):
    result = []
    if layer is None:
        layers = extract_layers(network_model)
        # if layers[0]['class_name'] != 'InputLayer':
        result.append({'name': 'input', 'index': 0, 'data': prepare_image(image, extract_input_shape(network_model)[1:]).reshape(-1).tolist()})
    output = model_output(network_model=network_model, image=image, hidden_config=hidden_config, target_layer=layer)
    for i in range(len(output)):
        temp_result = dict()
        item = np.asarray(output[i]['data']).reshape(-1)
        temp_result['name'] = output[i]['name']
        temp_result['index'] = output[i]['index'] + 1
        temp_result['data'] = item.tolist()
        result.append(temp_result)
    return result


def initialize_sequential(structure):
    """
    This memthod is used to initialize a new model based on the architecture description provided
    :return:
    """
    backend.clear_session()
    model = Sequential()
    structure = structure[1:]
    # specify the input shape
    for index in range(len(structure)):
        model = append_sequential_layer(model, structure[index])
    # model.compile()
    # For a multi-class classification problem
    # model.compile(optimizer='rmsprop', loss='categorical_crossentropy', metrics=['accuracy'])
    # For a binary classification problem
    # model.compile(optimizer='rmsprop',  loss='binary_crossentropy',  metrics=['accuracy'])
    return model


def append_sequential_layer(model, layer):
    """
    :param model: 目前构造出来的Sequential模型
    :param layer: 需要添加的层的信息
    :return: 添加该层后的模型
    """
    layers = extract_layers(model)
    class_name = layer['class_name']
    if len(layers) == 0:
        # add first layer
        input_shape = tuple(layer['config']['batch_input_shape'])
        if class_name == 'Conv2D':
            activation_function = layer['config']['activation']
            filter_num = int(layer['config']['filters'])
            filter_size = tuple([int(i) for i in layer['config']['kernel_size']])
            model.add(Conv2D(filter_num, filter_size, activation=activation_function, input_shape=input_shape))
        if class_name == 'Dense':
            activation_function = layer['config']['activation']
            unit_num = int(layer['config']['units'])
            model.add(Dense(unit_num, activation=activation_function, input_shape=input_shape))
    else:
        if class_name == 'Conv2D':
            activation_function = layer['config']['activation']
            filter_num = int(layer['config']['filters'])
            filter_size = tuple([int(i) for i in layer['config']['kernel_size']])
            model.add(Conv2D(filter_num, filter_size, activation=activation_function))
        if class_name == 'MaxPooling2D':
            pool_size = tuple([int(i) for i in layer['config']['pool_size']])
            model.add(MaxPooling2D(pool_size=pool_size))
        if class_name == 'Flatten':
            model.add(Flatten())
        if class_name == 'Dense':
            activation_function = layer['config']['activation']
            unit_num = int(layer['config']['units'])
            model.add(Dense(unit_num, activation=activation_function))
    return model


def load_intermediate(model_name, network_model, dataset_name):
    """
    为模型应用相应数据集去生成中间结果
    :param model_name: 模型的名称
    :param network_model: 模型本身
    :param dataset_name: 数据集名称
    :return:
    """
    layers = extract_layers(network_model)
    if dataset_name.upper() == 'MNIST':
        (x_train, y_train), (x_test, y_test) = mnist.load_data()
        input_shape = extract_input_shape(network_model)[1:]
        x_train = x_train.reshape(-1, input_shape[0], input_shape[1], input_shape[2])
        x_train = x_train.astype('float32') / 255
        for i in range(len(x_train)):
            image = x_train[i]
            expected_label = y_train[i]
            layer_input = [image]
            result = network_model.predict([layer_input])[0]
            actual_label = np.argmax(np.array(result))
            for l in range(len(layers)):
                layer_output = inner_output(network_model, layer_input, l)
                layer_input = layer_output
                structure_output.insert_scenario_snapshot(model_name, '{}_{}.png'.format(i, expected_label),
                                                          str(expected_label), str(actual_label), l,
                                                          dataset_name.upper(), layer_output.tolist())
    return


def similar(model_name, network_model, layer, data):
    layers = extract_layers(network_model)
    for index in range(len(layers)):
        if layer == layers[index]:
            break
    structure_output.query_similar_scenario(model_name, index, data)
    return


def convert(model_path, model_label, save_path):
    if str(model_label).lower() == str('keras'):
        command = "tensorflowjs_converter --input_format=keras " + model_path + ' ' + save_path
        os.system(command)
    else:
        return
