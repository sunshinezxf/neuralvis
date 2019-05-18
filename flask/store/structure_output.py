import pymongo as mongo

client = mongo.MongoClient('mongodb://127.0.0.1:27017')
database = client['nvis']


def insert_scenario_snapshot(model_name, image_name, expected_label, actual_label, layer, dataset_name, data):
    """
    使用该方法将输入在各层的输出保存
    :return:
    """
    collection = database['model_output_snapshot']
    data = {'model_name': model_name, 'image_name': image_name, 'expected_label': expected_label,
            'actual_label': actual_label, 'model_layer': layer, 'dataset': dataset_name, 'data': data}
    collection.save(data)
    return


def query_similar_scenario(model_name, layer, data):
    """
    根据图片某一层的输出去找出和它最相近的结果
    :param model:
    :param layer:
    :param data:
    :return:
    """
    snapshot_list = database.model_output_snapshot.find({"model_name": model_name, "model_layer": str(layer)})
    for snapshot_item in snapshot_list:

        print(snapshot_item)
    return
