---
layout: post
title:  "How to hide folders in Sublime Text"
date:   2018-1-12
categories:
---
In previous versions of Sublime Text if you wanted to hide a folder from the sidebar you would right click on a folder and choose the option to hide. In the current version, you need to edit the project file instead. Here's how to do that.

First you need to save your project. Go to (Project > Save Project As...).

Once you have your project saved go to (Project > Edit Project). This opens up a new tab with the following:

{% highlight ruby %}
{
 "folders":
  [
   {
    "path": "/your/project/path/here"
   }
  ]
}
{% endhighlight %}

Add the following lines to remove folders "folder_exclude_patterns" and files "file_exclude_patterns". If should look something like this when you are done.

{% highlight ruby %}
{
 "folders":
 [
  {
   "folder_exclude_patterns": [
     "name_of_folder_1",
     "name_of_folder_2"
    ],
    "file_exclude_patterns": [
     "name_of_file_1",
     "name_of_file_2"
    ],
    "path": "/your/project/path/here"
   }
 ]
}
{% endhighlight %}