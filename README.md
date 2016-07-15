# Picopico Sequencer
====================
__picopico sequencer__ is a web-based and Flash-free music sequencer and sythesizer.
It employs the brand new __WebAudio API__ for playing the sounds. So as of now it's very likely that Picopico Sequencer only works properly on
Google Chrome.

The Japanese word "Picopico" generally refers to the sounds produced by the traditional video game consoles such as the Family Computer and
Super Family Computer(SFC), which are also known as NES and SNES in English-spoken countries. So the name "Picopico Sequencer" suggests that
the program can only produce such eh...(I don't know how it can be described in English) primitive sounds.

Notice that the program can't be run out-of-the-box because it lacks some dependencies by default. So you must first explicitly install extra
dependency files.
See the __How to run the program__ section for more details.

## Features
  * MML editing
  * A visual representation in piano roll
  * Total of 6 types of "primitive" sound waves
  * The potential of generating any type of sound
  * Saving edited files to LocalStorage, the server or the local system
  * Opening files from LocalStorage, the server or the local system
  * MML editing in GUI(not yet implemented)

## How to run the program
As mentioned above, you can't run the program out of the box. To run the program, you need to have the __dojo__ library in the proper directory.
There are two ways to do that. One is to download __dojo__ files and move the files to the proper directory by yourself.
And the other is to simply use the `git submodule` commands. In detail you must first execute `git submodule init` on the root directory of the
project and then just type `git submodule update` or just use `git submodule update --init --recursive`. Then it will collect all modules the
program needs and will immediately take you to the tour of the program.

## Just before the release...
At the very end of development, you must build the program to reduce the number of HTTPRequests and the program size. To do that, you must just
invoke the build.sh at the root directory of the project.

## Dependent Open Source Projects
  * [dojo] for the great graphical user interfaces
  * [treehugger] for the AST of parsed MML
  * [jasmine] for testing framework

## Links to dependency projects
I'd like to say a big "Thank you" to all developers and contributors of these projects!

[dojo]: http://dojotoolkit.org/
[treehugger]: http://github.com/ajaxorg/treehugger
[jasmine]: http://pivotal.github.com/jasmine/

## License
The program is published under the BSD license. The text of BSD license is reprodued below.
------------------
Copyright (c) 2005-2015, The Dojo Foundation All rights reserved.
Copyright (c) 2012-2016, Ryota Ozaki All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
Neither the name of the Dojo Foundation nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
