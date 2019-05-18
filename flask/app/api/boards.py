# -*- coding: utf-8 -*-

import base64
import io
import json
import os
import uuid

from PIL import Image
from flask import request, session, send_from_directory, jsonify

from config import basedir, Config
from manage import app
from nn import adversarial
from nn import network_model
from nn import util
from . import api
from ..response_data import response_data


@api.route('/', methods=['GET'])
def index():
    return 'hello world'


@api.route('/models', methods=['GET'])
def get_models():
    """
    从session中获取已经上传过的model文件名称，用于查找并加载模型。
    其中key是'models'
    :return: 模型文件列表
    """
    if session and 'models' in session.keys():
        return response_data(200, ['lenet_mnist_1_c687c7c6-1e06-11e9-8f5a-acde48001122.h5', 'model_20190123_1445CIFAR10-EP35-ACC0.8680a7d286af-3f3d-a82c-cda0-89e8eca7af00.h5'] + session.get('models'))
    else:
        return response_data(200, ['lenet_mnist_1_c687c7c6-1e06-11e9-8f5a-acde48001122.h5', 'model_20190123_1445CIFAR10-EP35-ACC0.8680a7d286af-3f3d-a82c-cda0-89e8eca7af00.h5'])


@api.route('/images', methods=['GET'])
def get_images():
    """
    从session中获取已经上传过的图片文件名称，用于展示图片。
    其中key是'images'
    :return:
    """
    if session and 'images' in session.keys():
        return response_data(200, ['7_1_294a231e-d845-11e8-9af7-acde48001122.jpg',
                                   '7_1_82986a2c-d845-11e8-a9f4-acde48001122.jpg', '8884_0_e6e644c2-1eef-11e9-b671-acde48001122.png', '8876_0_d287e04c-1eef-11e9-b171-acde48001122.png'] + session.get('images'))
    else:
        return response_data(200, ['7_1_294a231e-d845-11e8-9af7-acde48001122.jpg',
                                   '7_1_82986a2c-d845-11e8-a9f4-acde48001122.jpg', '8884_0_e6e644c2-1eef-11e9-b671-acde48001122.png', '8876_0_d287e04c-1eef-11e9-b171-acde48001122.png'])


@api.route('/model/upload/slice', methods=['POST'])
def upload_model_slice():
    file_dir = os.path.join(basedir, Config.UPLOAD_MODEL_FOLDER)
    if not os.path.exists(file_dir):
        os.makedirs(file_dir)

    f = request.files['model']
    if f is None:
        return response_data(400, message='The file is empty!')
    filename = request.form.get('filename')
    print(filename)
    if allowed_model_extensions(filename):
        filename = filename.rsplit('.', 1)
        task = request.form.get('task_id')
        start = request.form.get('start')
        end = request.form.get('end')
        new_filename = '{}_{}_{}_{}.{}'.format(filename[0], task, start, end, filename[1])
        print(os.path.join(file_dir, new_filename))
        f.save(os.path.join(file_dir, new_filename))
        return response_data(200, {
            'start': int(start),
            'end': int(end),
            'slice_name': new_filename
        }, 'success')
    else:
        return response_data(400, message='The model extension is not allowed!')


@api.route('/model/upload/success', methods=['POST'])
def upload_model_success():
    target_filename = request.json['filename']
    target_filename = target_filename.rsplit('.', 1)
    task_id = request.json['task_id']
    slices = request.json['slices']

    file_dir = os.path.join(basedir, Config.UPLOAD_MODEL_FOLDER)
    save_dir = os.path.join(basedir, Config.UPLOAD_MODEL_CONVERT_FOLDER)

    new_filename = target_filename[0] + task_id + '.' + target_filename[1]
    with open(os.path.join(file_dir, new_filename), 'wb') as target_file:
        for s in slices:
            source_file = open(os.path.join(file_dir, s), 'rb')
            target_file.write(source_file.read())
            source_file.close()
            os.remove(os.path.join(file_dir, s))
        target_file.close()
        network_model.convert(os.path.join(file_dir, new_filename), 'keras', os.path.join(save_dir, new_filename))
        # 将该用户的历史文件保存在session中
        if session and 'models' in session.keys():
            session['models'].append(new_filename)
            session.modified = True
        else:
            session.setdefault('models', [new_filename])
        return response_data(200, new_filename)


@api.route('/model/upload', methods=['POST'])
def upload_model():
    """
    用户模型上传，目前接受h5和hdf5文件。
    其中上传的文件的key是'model'。
    上传的模型会使用一个<模型名称>_uuid作为文件名称保存在networks/models下
    :return: 模型文件名(包括扩展名称)以及相关http信息
    """
    file_dir = os.path.join(basedir, Config.UPLOAD_MODEL_FOLDER)
    save_dir = os.path.join(basedir, Config.UPLOAD_MODEL_CONVERT_FOLDER)
    if not os.path.exists(file_dir):
        os.makedirs(file_dir)
    if not os.path.exists(save_dir):
        os.mkdir(save_dir)
    f = request.files['model']

    if f is None:
        return response_data(400, message='The file is empty!')

    app.logger.info('model name: {}'.format(f.filename))

    # 检查文件扩展名是否符合模型文件要求
    if allowed_model_extensions(f.filename):
        filename = f.filename.rsplit('.', 1)
        new_filename = '{}_{}.{}'.format(filename[0], uuid.uuid1(), filename[1])
        f.save(os.path.join(file_dir, new_filename))
        if not os.path.exists(save_dir):
            os.mkdir(save_dir)
        network_model.convert(os.path.join(file_dir, new_filename), 'keras', os.path.join(save_dir, new_filename))
        # 将该用户的历史文件保存在session中
        if session and 'models' in session.keys():
            session['models'].append(new_filename)
            session.modified = True
        else:
            session.setdefault('models', [new_filename])
        return response_data(200, new_filename)
    else:
        return response_data(400, message='The model extension is not allowed!')


@api.route('/image/upload', methods=['POST'])
def upload_image():
    """
    用户需要识别的图片上传，目前接受jpg、jpeg和png文件。
    其中上传的文件的key是'image'。
    上传的图片会使用一个<图片名称>_uuid作为文件名称保存在networks/images下。
    TODO: 同时接受图片需要运行于的模型名称的参数，在这一步就进行模型的运行。

    :return: 图片文件名(包括扩展名称)，模型总体的运行信息以及相关http信息
    """
    # model_file_name = request.args.get('image')
    # if not model_exist(model_file_name):
    #     return response_data(400, 'The model file does not exist!')
    # model_path = os.path.join(basedir, Config.UPLOAD_MODEL_FOLDER, model_file_name)

    file_dir = os.path.join(basedir, Config.UPLOAD_IMAGE_FOLDER)
    if not os.path.exists(file_dir):
        os.makedirs(file_dir)
    f = request.files['image']

    if f is None:
        return response_data(400, message='The file is empty!')

    # 检查文件扩展名是否符合模型文件要求
    if allowed_image_extensions(f.filename):
        filename = f.filename.rsplit('.', 1)
        new_filename = '{}_{}.{}'.format(filename[0], uuid.uuid1(), filename[1])
        f.save(os.path.join(file_dir, new_filename))
        # 将该用户的历史文件保存在session中
        if session and 'images' in session.keys():
            session['images'].append(new_filename)
            session.modified = True
        else:
            session.setdefault('images', [new_filename])
        # TODO: 在上传图片的时候运行模型并且保存模型每一层运行结果，在下方进行书写
        # -----------------------------------------------------------------------
        result = {
            'image': new_filename,
            # TODO: 返回与get_model_static_info相同的结构信息，额外添加被激活的neuron百分比数据等
        }
        return response_data(200, result)
    else:
        return response_data(400, message='The image extension is not allowed!')


@api.route('/image/sketchpad/upload', methods=['POST'])
def upload_sketchpad_image():
    """
    用户手绘图片上传，手写的数字
    上传数据时数字的base64编码，key为'image'，会保存图片并且返回生成的图片名
    :return: 图片文件名称，包括扩展名
    """
    file_dir = os.path.join(basedir, Config.UPLOAD_IMAGE_FOLDER)
    if not os.path.exists(file_dir):
        os.makedirs(file_dir)
    f = request.json['image']

    if f is None:
        return response_data(400, message='The file is empty!')

    # base64解码
    print(f)
    image = base64.b64decode(f)
    image = io.BytesIO(image)
    image = Image.open(image)

    new_filename = '{}.{}'.format(uuid.uuid1(), 'jpg')
    image.save(os.path.join(file_dir, new_filename))

    # 将该用户的历史文件保存在session中
    if session and 'images' in session.keys():
        session['images'].append(new_filename)
        session.modified = True
    else:
        session.setdefault('images', [new_filename])

    return response_data(200, data={
        'image': new_filename
    })


@api.route('/model/info', methods=['GET'])
def get_model_static_info():
    """
    获取模型静态结构。
    通过request.args获取参数(模型文件名称)，以此来获取模型结构信息。

    :return: 模型结构信息以及相关http信息
    """
    model_file_name = request.args.get('model')
    if not model_exist(model_file_name):
        return response_data(400, message='The model file does not exist!')

    app.logger.info('load model: {}'.format(model_file_name))

    model_path = os.path.join(basedir, Config.UPLOAD_MODEL_FOLDER, model_file_name)
    detail = network_model.load_model(model_path).to_json()
    result = json.loads(detail, encoding='utf-8')
    return response_data(200, result)


@api.route('/image', methods=['GET'])
def get_image():
    """
    根据图片文件名称获取图片的base64编码。
    通过request.args获取参数(模型文件名称)

    :return: 图片base64编码以及相关http信息
    """
    image_file_name = request.args.get('image')
    print(image_file_name)
    if not image_exist(image_file_name):
        return response_data(400, message='The image file does not exist!')

    app.logger.info('get image: {}'.format(image_file_name))

    image = open(os.path.join(basedir, Config.UPLOAD_IMAGE_FOLDER, image_file_name), 'rb').read()
    b64data = base64.b64encode(image)
    return response_data(200, str(b64data))


@api.route('/model/layer/info', methods=['POST'])
def get_model_layer_info():
    """
    获取模型某一层的动态结构。
    通过request.args获取参数(模型文件名称、图片文件名称、选择的层的下标)，以此来获取某一层的动态信息。
    获得cnn隐藏filter的index和层的名称。
    hidden_config格式: [{ 'layer_name': ..., 'feature_index': ... }]

    :return: 某一层的动态信息以及相关http信息
    """
    params = request.json
    model_file_name = params['model']
    image_file_name = params['image']
    layer_name = params['layer']
    hidden_config = params['hidden_config']
    # if hidden_config is not None:
    #     hidden_config = json.load(StringIO(hidden_config))
    print(hidden_config)
    if not model_exist(model_file_name):
        return response_data(400, message='The model file does not exist!')
    model_path = os.path.join(basedir, Config.UPLOAD_MODEL_FOLDER, model_file_name)
    if not image_exist(image_file_name):
        return response_data(400, message='The image file does not exist!')
    image_path = os.path.join(basedir, Config.UPLOAD_IMAGE_FOLDER, image_file_name)
    image = Image.open(image_path)
    app.logger.info(
        'image: {}, model: {}, layer: {}'.format(image_file_name, model_file_name, hidden_config=layer_name))
    model = network_model.load_model(model_path)

    output = network_model.model_output(model, image, target_layer=layer_name, hidden_config=hidden_config)
    # ------------------------------------------------------------------
    return response_data(200, output)


@api.route('/model/tensorspace/info', methods=['POST'])
def get_tensorspace_output():
    params = request.json
    model_file_name = params['model']
    image_file_name = params['image']
    hidden_config = params['hidden_config']
    if not model_exist(model_file_name):
        return response_data(400, message="The model file does not exist")
    model_path = os.path.join(basedir, Config.UPLOAD_MODEL_FOLDER, model_file_name)
    if not image_exist(image_file_name):
        return response_data(400, message="The image file does not exist")
    image_path = os.path.join(basedir, Config.UPLOAD_IMAGE_FOLDER, image_file_name)
    image = Image.open(image_path)
    model = network_model.load_model(model_path)
    output = network_model.model_output4tensor(model, image, hidden_config)
    return response_data(200, output)


@api.route('/tensorspace/images/compare', methods=['POST'])
def get_differential_input():
    """
    获取多张图片的输出
    :return:
    """
    params = request.json
    model_file_name = params['model']
    layer_name = params['layer']
    image_list = params['images']
    hidden_config = params['hidden_config']
    if not model_exist(model_file_name):
        return response_data(400, message="The model file does not exist")
    model_path = os.path.join(basedir, Config.UPLOAD_MODEL_FOLDER, model_file_name)
    for i in range(len(image_list)):
        if not image_exist(image_list[i]):
            return response_data(400, message=image_list[i] + " does not exist")
    images = [Image.open(os.path.join(basedir, Config.UPLOAD_IMAGE_FOLDER, i)) for i in image_list]
    print(images)
    result = []
    model = network_model.load_model(model_path)
    for i in range(len(images)):
        output = network_model.model_output4tensor(model, images[i], hidden_config, layer_name)
        result.append(output)
    return response_data(200, result)


@api.route('/tensorspace/model/info', methods=['GET'])
def get_model_info():
    """
    获取模型的tensorspace格式的结构和权重信息
    :return:
    """
    # params = request.json
    model_file_name = request.args['model']
    if not model_exist(model_file_name):
        return response_data(400, message='The model file does not exist')
    tensor_model_dir = os.path.join(basedir, Config.UPLOAD_MODEL_CONVERT_FOLDER) + '/' + model_file_name
    if not model_exist(model_file_name):
        # 当前不存在该模型的tensor结构
        app.logger.info('当前不存在该模型的tensor结构')
        return response_data(400, data=None, message='The model file does not exist!')
    else:
        # 获取文件夹中的model.json
        model_json = tensor_model_dir + '/model.json'
        with open(model_json, 'r') as load_file:
            output = json.load(load_file)
            return jsonify(output), 200
        # return  response_data(400, data=None, message='Load model error!')


@api.route('/tensorspace/model/<name>', methods=['GET'])
def get_model_weight(name):
    """
    获取模型的权重信息
    :return:
    """
    model_name = request.args.get('model')
    if not model_exist(model_name):
        return response_data(400, message='The model file does not exist')
    tensor_weight_dir = os.path.join(basedir, Config.UPLOAD_MODEL_CONVERT_FOLDER + '/' + model_name)
    if not os.path.exists(tensor_weight_dir):
        app.logger.info()
    else:
        # weight_file = tensor_weight_dir + '/' + name
        return send_from_directory(tensor_weight_dir, name, as_attachment=True)
    # return response_data(200, message="weight file returned")


@api.route('/model/create', methods=['POST'])
def create_model():
    """
    根据用户上传的网络的层的配置信息、模型的类型和模型节点之间的描述
    :return:
    """
    params = request.json
    node_num = params['node']
    layer_info = params['layer']
    model_name = params['model']
    path_info = params['path']

    print(node_num, len(path_info))

    if model_name == 'Sequential' and not util.is_linear(node_num, path_info):
        return response_data(400, message='The path uploaded cannot meet the requirement of sequential')
    if model_name != 'Sequential':
        return response_data(400, message='Only sequential model can be handled at the moment')
    if model_name == 'Sequential' and util.is_linear(node_num, path_info):
        # Create a sequential model according to the layer info
        layer_structure = util.sort_layer(layer_info, path_info, node_num)
        model = network_model.initialize_sequential(layer_structure)
    file_dir = os.path.join(basedir, Config.UPLOAD_MODEL_FOLDER)
    if not os.path.exists(file_dir):
        os.makedirs(file_dir)
    file_name = '{}_{}.hdf5'.format(model_name, uuid.uuid1())
    model.save(file_dir + file_name)
    if session and 'models' in session.keys():
        session['models'].append(file_name)
        session.modified = True
    else:
        session.setdefault('models', [file_name])
    return response_data(200, file_name)


@api.route('/model/download', methods=['GET'])
def download_model():
    """
    根据用户请求的模型名称下载
    :return:
    """
    model_name = request.args.get('model_name')
    if model_name is None:
        return response_data(400, message="请确认需要获取的模型名称")
    file_dir = os.path.join(basedir, Config.UPLOAD_MODEL_FOLDER)
    model_path = file_dir + model_name
    if os.path.isfile(model_path):
        return send_from_directory(file_dir, model_name, as_attachment=True)
    else:
        return response_data(400, message="请确认需要获取的模型名称")


@api.route('/model/dataset/prep', methods=['POST'])
def prep_intermediate():
    params = request.json
    model_name = params['model_name']
    dataset_name = params['dataset_name']
    if model_name is None or dataset_name is None:
        return response_data(400, message="请确认模型及所要处理的数据集")
    model_path = os.path.join(basedir, Config.UPLOAD_MODEL_FOLDER, model_name)
    model = network_model.load_model(model_path)
    network_model.load_intermediate(model_name=model_name, network_model=model, dataset_name=dataset_name)
    return response_data(200, message="完成对于该模型数据集中间数据的分析")


@api.route('/model/adversarial', methods=['POST'])
def create_adv_sample():
    """
    根据指定的攻击方法，对于指定的模型和输入创建对抗样本
    :return:
    """
    params = request.json
    model_name = params['model_name']
    input_name = params['image']
    attack_method = params['attack_method']
    labeled = params['labeled'] if 'labeled' in params else None
    target = params['target'] if 'target' in params else 5
    if model_name is None or input_name is None or attack_method is None:
        return response_data(400, message="请提供参数模型名称(model_name), 图像文件名称(image), 攻击方法(attack_method)")
    # 获取模型文件
    model_path = os.path.join(basedir, Config.UPLOAD_MODEL_FOLDER, model_name)
    if not os.path.exists(model_path):
        return response_data(400, message="指定的模型文件不存在，请重新上传")
    model = network_model.load_model(model_path)
    # 获取输入文件
    image_path = os.path.join(basedir, Config.UPLOAD_IMAGE_FOLDER, input_name)
    image = Image.open(image_path)
    print(input_name)
    result, adv_image_name = adversarial.sample_attack(model, image, attack_method, input_name, labeled=labeled, target=target)
    if result is None:
        return response_data(400, message=adv_image_name)
    if session and 'images' in session.keys() and result is not None and adv_image_name is not None:
        session['images'].append(adv_image_name)
        session.modified = True
    else:
        session.setdefault('images', [adv_image_name])
    return response_data(200, {
        'image': adv_image_name
    })


def allowed_model_extensions(file_name):
    """
    检查模型文件扩展名是否符合要求。允许的扩展名见ALLOWED_MODEL_EXTENSIONS。

    :param file_name: 模型文件名称
    :return: 如何符合要求返回True，否则返回False
    """
    return '.' in file_name and file_name.rsplit('.', 1)[1] in Config.ALLOWED_MODEL_EXTENSIONS


def allowed_image_extensions(file_name):
    """
    检查图片文件扩展名是否符合要求。允许的扩展名见ALLOWED_IMAGE_EXTENSIONS。

    :param file_name: 图片文件名称
    :return: 如何符合要求返回True，否则返回False
    """
    return '.' in file_name and file_name.rsplit('.', 1)[1] in Config.ALLOWED_IMAGE_EXTENSIONS


def model_exist(model_file_name):
    """
    检查给出的模型文件名称对应的模型是否存在。

    :param model_file_name: 模型文件名称
    :return: 如果文件存在则返回True，否则返回False
    """
    return model_file_name is not None and os.path.exists(
        os.path.join(basedir, Config.UPLOAD_MODEL_FOLDER, model_file_name))


def image_exist(image_file_name):
    """
    检查给出的图片文件名称对于的图片是否存在。

    :param image_file_name: 图片文件名称
    :return: 如果文件存在则返回True，否则返回False
    """
    return image_file_name is not None and os.path.exists(
        os.path.join(basedir, Config.UPLOAD_IMAGE_FOLDER, image_file_name))
